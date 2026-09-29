// A list read asked for before a confirmed edit must not undo it; a read asked for after may.
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { onTestFinished, test } from 'vitest'
import { createActor, toPromise } from 'xstate'
import { openDatabase } from '@/database/database'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/api/ticket'
import { readActiveTickets } from '../database/ticket-queries'
import { saveConfirmedFields } from '../database/ticket-upsert'
import {
  changeTicketStatus,
  ticketOperationSupervisorMachine,
} from '../operations/ticket-operation-supervisor-machine'
import { type PageRead, ticketSyncMachine } from './ticket-sync-machine'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const DONE: TicketStatus = { id: 'done', name: 'Done', category: 'completed' }
const URGENT: TicketPriority = { level: 1, label: 'Urgent' }
const SCOPE = { provider: 'github', scope: 'octocat/hello-world' } as const
const TARGET = { ...SCOPE, kind: 'active' } as const

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  key: '#1',
  url: null,
  title: 'Ticket 1',
  body: null,
  state: 'open',
  status: OPEN,
  priority: null,
  createdAt: '2026-09-29T00:00:00Z',
  labels: [],
  type: null,
  children: [],
  blockedBy: null,
  ...overrides,
})

// Waits until the scan has asked the provider for `count` pages, which it holds.
async function asked(held: unknown[], count: number) {
  for (let attempt = 0; attempt < 200 && held.length < count; attempt += 1)
    await new Promise((settle) => setTimeout(settle, 5))
  assert.equal(held.length, count)
}

async function cockpit() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-race-'))
  onTestFinished(() => rm(directory, { force: true, recursive: true }))
  const database = openDatabase(directory)
  onTestFinished(() => database.$client.close())
  const held: Array<(read: PageRead) => void> = []
  const scan = () =>
    toPromise(
      createActor(ticketSyncMachine, {
        input: {
          dependencies: {
            database,
            readPage: () => new Promise<PageRead>((settle) => held.push(settle)),
            readTicket: async () => ({ ok: false, failure: 'github-unreachable' }),
            changed: () => {},
          },
          target: TARGET,
          accountId: 'github:1',
          more: false,
        },
      }).start(),
    )
  const operations = createActor(ticketOperationSupervisorMachine, {
    input: {
      database,
      write: async () => ({ ok: true, confirmed: { operation: 'status', status: DONE } }),
      changed: () => {},
    },
  }).start()
  onTestFinished(() => {
    operations.stop()
  })
  const listed = () => readActiveTickets(database, { ...SCOPE, page: 0, pageSize: 25 }).tickets[0]
  const page = (...tickets: Ticket[]): PageRead => ({
    ok: true,
    value: { tickets, statuses: [OPEN, DONE], nextCursor: null, total: null },
  })
  return { database, operations, held, scan, listed, page }
}

test('a list read asked for before a confirmed status cannot replace it, and a later read can', async () => {
  const { operations, held, scan, listed, page } = await cockpit()
  const first = scan()
  await asked(held, 1)
  held.shift()?.(page(ticket()))
  await first
  assert.equal(listed()?.status.id, 'open')

  const stale = scan()
  await asked(held, 1)
  const outcome = await changeTicketStatus(operations, {
    ...SCOPE,
    accountId: 'github:1',
    operation: 'status',
    key: '#1',
    statusId: 'done',
  })
  assert.equal(outcome.type, 'committed')
  held.shift()?.(page(ticket({ title: 'Renamed' })))
  await stale
  assert.equal(listed()?.status.id, 'done')

  const fresh = scan()
  await asked(held, 1)
  held.shift()?.(page(ticket({ status: OPEN, title: 'Reopened on GitHub' })))
  await fresh
  assert.equal(listed()?.status.id, 'open')
  assert.equal(listed()?.title, 'Reopened on GitHub')
})

test('a list read asked for before a confirmed priority cannot replace it', async () => {
  const { database, held, scan, listed, page } = await cockpit()
  const first = scan()
  await asked(held, 1)
  held.shift()?.(page(ticket()))
  await first

  const stale = scan()
  await asked(held, 1)
  saveConfirmedFields(database, { ...SCOPE, key: '#1' }, { priority: URGENT })
  held.shift()?.(page(ticket()))
  await stale
  assert.deepEqual(listed()?.priority, URGENT)

  const fresh = scan()
  await asked(held, 1)
  held.shift()?.(page(ticket({ priority: null })))
  await fresh
  assert.equal(listed()?.priority, null)
})
