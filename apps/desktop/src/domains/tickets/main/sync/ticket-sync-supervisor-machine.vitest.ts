import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'vitest'
import { createActor } from 'xstate'
import { type Database, openDatabase } from '@/database/database'
import type { Ticket, TicketStatus } from '@/domains/tickets/contract/contract'
import { readActiveTickets } from '../database/ticket-queries'
import type { PageRead, TicketSyncRequest } from './ticket-sync-machine'
import { ticketSyncSupervisorMachine } from './ticket-sync-supervisor-machine'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const REQUEST: TicketSyncRequest = {
  provider: 'github',
  scope: 'octocat/hello-world',
  accountId: 'github:583231',
}

const ticket = (number: number): Ticket => ({
  key: `#${number}`,
  url: null,
  title: `Ticket ${number}`,
  body: null,
  state: 'open',
  status: OPEN,
  priority: null,
  createdAt: '2026-09-01T00:00:00Z',
  labels: [],
  type: null,
  children: [],
  blockedBy: null,
})

let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-sync-'))
  database = openDatabase(directory)
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

const read = () =>
  readActiveTickets(database, { provider: 'github', scope: REQUEST.scope, page: 0, pageSize: 25 })

// The children's progress is not the supervisor's snapshot, so the test polls what it can see.
async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 200 && !condition(); attempt += 1)
    await new Promise((settle) => setTimeout(settle, 5))
  assert.equal(condition(), true)
}

function deferred() {
  let resolve: (read: PageRead) => void = () => {}
  const promise = new Promise<PageRead>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

test('a Sync commits every page before it notifies, and a Sync during the scan runs once after it', async () => {
  const reads: (string | null)[] = []
  const gates = [deferred(), deferred(), deferred()]
  const changes: string[] = []
  const supervisor = createActor(ticketSyncSupervisorMachine, {
    input: {
      database,
      readPage: (_request, cursor) => {
        reads.push(cursor)
        return gates[reads.length - 1]?.promise ?? Promise.reject(new Error('Too many reads.'))
      },
      changed: (target) => {
        // Exactly the scope, as the renderer's change subscription parses it.
        assert.deepEqual(target, { provider: 'github', scope: REQUEST.scope })
        changes.push(read().sync.phase)
      },
    },
  }).start()
  supervisor.send({ type: 'Sync', request: REQUEST })
  supervisor.send({ type: 'Sync', request: REQUEST })
  supervisor.send({ type: 'Sync', request: REQUEST })
  await new Promise((settle) => setTimeout(settle, 0))
  assert.deepEqual(reads, [null])

  gates[0]?.resolve({
    ok: true,
    value: { tickets: [ticket(1)], statuses: [OPEN], nextCursor: '2', total: null },
  })
  await until(() => reads.length === 2)
  gates[1]?.resolve({
    ok: true,
    value: { tickets: [ticket(2)], statuses: [OPEN], nextCursor: null, total: null },
  })
  await until(() => reads.length === 3)
  assert.deepEqual(
    read().tickets.map(({ key }) => key),
    ['#1', '#2'],
  )
  assert.equal(read().sync.complete, true)
  // Each notification saw its commit already in SQLite.
  assert.deepEqual(changes, ['syncing', 'syncing', 'syncing', 'ready', 'syncing'])

  gates[2]?.resolve({ ok: false, failure: 'github-unreachable' })
  await until(() => read().sync.phase === 'failed')
  assert.deepEqual(reads, [null, '2', null])
  assert.deepEqual(
    read().tickets.map(({ key }) => key),
    ['#1', '#2'],
  )
  supervisor.stop()
})

test('scans of different scopes run side by side', async () => {
  const scopes: string[] = []
  const supervisor = createActor(ticketSyncSupervisorMachine, {
    input: {
      database,
      readPage: async (request) => {
        scopes.push(request.scope)
        return { ok: true, value: { tickets: [], statuses: [], nextCursor: null, total: null } }
      },
      changed: () => {},
    },
  }).start()
  supervisor.send({ type: 'Sync', request: REQUEST })
  supervisor.send({ type: 'Sync', request: { ...REQUEST, scope: 'octocat/other' } })
  await until(() => scopes.length === 2)
  assert.deepEqual(scopes.toSorted(), ['octocat/hello-world', 'octocat/other'])
  supervisor.stop()
})
