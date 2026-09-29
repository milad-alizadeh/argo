import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'vitest'
import { createActor } from 'xstate'
import { type Database, openDatabase } from '@/database/database'
import type { Ticket, TicketStatus } from '@/domains/tickets/contract/contract'
import { readActiveTickets } from '../database/ticket-queries'
import type { PageRead, TicketSyncDependencies, TicketSyncRequest } from './ticket-sync-machine'
import {
  nextScanDelay,
  TICKET_SYNC_TIMING,
  type TicketSyncTiming,
  ticketSyncSupervisorMachine,
} from './ticket-sync-supervisor-machine'

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
      timing: TICKET_SYNC_TIMING,
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
      timing: TICKET_SYNC_TIMING,
    },
  }).start()
  supervisor.send({ type: 'Sync', request: REQUEST })
  supervisor.send({ type: 'Sync', request: { ...REQUEST, scope: 'octocat/other' } })
  await until(() => scopes.length === 2)
  assert.deepEqual(scopes.toSorted(), ['octocat/hello-world', 'octocat/other'])
  supervisor.stop()
})

const EMPTY: PageRead = {
  ok: true,
  value: { tickets: [], statuses: [], nextCursor: null, total: null },
}
const settle = (milliseconds: number) => new Promise((done) => setTimeout(done, milliseconds))

// Every read's time, answered by `answers` in order and then by its last entry.
function recordedReads(answers: readonly PageRead[]) {
  const times: number[] = []
  const readPage = async () => {
    times.push(performance.now())
    return answers[Math.min(times.length, answers.length) - 1] ?? EMPTY
  }
  return { times, readPage }
}

function watchingSupervisor(
  readPage: TicketSyncDependencies['readPage'],
  timing: TicketSyncTiming,
) {
  return createActor(ticketSyncSupervisorMachine, {
    input: { database, readPage, changed: () => {}, timing },
  }).start()
}

test('a watched scope scans when watched, polls only while visible, and scans when the window returns', async () => {
  const { times, readPage } = recordedReads([EMPTY])
  const supervisor = watchingSupervisor(readPage, { pollMs: 40, retryMs: 40, retryCapMs: 40 })
  supervisor.send({ type: 'Watch', watcherId: 'screen', request: REQUEST })
  await until(() => times.length === 1)
  // A hidden window is not polled.
  await settle(150)
  assert.equal(times.length, 1)

  supervisor.send({ type: 'Visibility', visible: true })
  await until(() => times.length === 2)
  await until(() => times.length >= 4)

  supervisor.send({ type: 'Visibility', visible: false })
  await settle(60)
  const hidden = times.length
  await settle(150)
  assert.equal(times.length, hidden)

  // A scope nobody watches is not scanned when the window returns.
  supervisor.send({ type: 'Unwatch', watcherId: 'screen' })
  supervisor.send({ type: 'Visibility', visible: true })
  await settle(150)
  assert.equal(times.length, hidden)
  supervisor.stop()
})

test('a second view of a watched scope shares it, and switching to another scope scans that one', async () => {
  const scopes: string[] = []
  const supervisor = watchingSupervisor(
    async (request) => {
      scopes.push(request.scope)
      return EMPTY
    },
    { pollMs: 60_000, retryMs: 60_000, retryCapMs: 60_000 },
  )
  supervisor.send({ type: 'Visibility', visible: true })
  supervisor.send({ type: 'Watch', watcherId: 'screen', request: REQUEST })
  await until(() => scopes.length === 1)
  await settle(50)
  // The scan finished and its poll is a minute away, so a second view reads nothing new.
  supervisor.send({ type: 'Watch', watcherId: 'sidebar', request: REQUEST })
  await settle(100)
  assert.deepEqual(scopes, [REQUEST.scope])

  const other = { ...REQUEST, scope: 'octocat/other' }
  supervisor.send({ type: 'Unwatch', watcherId: 'sidebar' })
  supervisor.send({ type: 'Watch', watcherId: 'sidebar', request: other })
  await until(() => scopes.length === 2)
  assert.equal(scopes[1], 'octocat/other')
  supervisor.stop()
})

test('a failure only a person can clear is not retried until the scope is watched again', async () => {
  const { times, readPage } = recordedReads([{ ok: false, failure: 'repository-not-visible' }])
  const supervisor = watchingSupervisor(readPage, { pollMs: 20, retryMs: 20, retryCapMs: 20 })
  supervisor.send({ type: 'Visibility', visible: true })
  supervisor.send({ type: 'Watch', watcherId: 'screen', request: REQUEST })
  await until(() => times.length === 1)
  await settle(150)
  assert.equal(times.length, 1)
  assert.equal(read().sync.failure, 'repository-not-visible')

  supervisor.send({ type: 'Unwatch', watcherId: 'screen' })
  supervisor.send({ type: 'Watch', watcherId: 'screen', request: REQUEST })
  await until(() => times.length === 2)
  supervisor.stop()
})

test('failed scans keep committed rows and retry sooner, backing off to the bound', async () => {
  const failed: PageRead = { ok: false, failure: 'github-unreachable' }
  const listed: PageRead = {
    ok: true,
    value: { tickets: [ticket(1)], statuses: [OPEN], nextCursor: null, total: null },
  }
  const timing = { pollMs: 30, retryMs: 20, retryCapMs: 80 }
  const { times, readPage } = recordedReads([listed, failed])
  const supervisor = watchingSupervisor(readPage, timing)
  supervisor.send({ type: 'Visibility', visible: true })
  supervisor.send({ type: 'Watch', watcherId: 'screen', request: REQUEST })
  await until(() => times.length >= 6)
  supervisor.stop()
  // A retry leaves the last failure in place until it has its own answer.
  assert.equal(read().sync.failure, 'github-unreachable')
  const gaps = times.slice(1, 6).map((time, index) => time - (times[index] ?? 0))
  // After the listing, the poll; after each failure, the doubled retry up to its bound.
  const expected = [30, 20, 40, 80, 80]
  // A timer never fires early, but its clock is coarser than a millisecond.
  for (const [index, gap] of gaps.entries())
    assert.ok(gap >= (expected[index] ?? 0) - 2, `gap ${index}: ${gap}`)
  assert.equal(read().sync.phase, 'failed')
  assert.deepEqual(
    read().tickets.map(({ key }) => key),
    ['#1'],
  )
})

test('the wait after a scan is the poll, or the doubled retry up to its bound', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 6, 50].map((failures) => nextScanDelay(TICKET_SYNC_TIMING, failures)),
    [60_000, 5_000, 10_000, 20_000, 160_000, 300_000],
  )
})
