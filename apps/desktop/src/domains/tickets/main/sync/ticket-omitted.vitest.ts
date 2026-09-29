import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import type { Ticket, TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'
import { readActiveTickets, readClosedTickets, readSavedTicket } from '../database/ticket-queries'
import { saveListedTickets } from '../database/ticket-upsert'
import { resolveOmittedTickets, type TicketRead } from './ticket-omitted'
import { beginTicketScan, completeTicketScan } from './ticket-sync-records'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const DONE: TicketStatus = { id: 'completed', name: 'Closed as completed', category: 'completed' }
const SCOPE = { provider: 'github', scope: 'octocat/hello-world' } as const
const ACTIVE = { ...SCOPE, kind: 'active' } as const
const ACCOUNT = 'github:583231'

const ticket = (number: number, state: Ticket['state'] = 'open'): Ticket => ({
  children: [],
  blockedBy: null,
  labels: [],
  type: null,
  key: `#${number}`,
  title: `Ticket ${number}`,
  state,
  status: state === 'open' ? OPEN : DONE,
  createdAt: '2026-09-01T00:00:00Z',
  url: null,
  body: null,
  priority: null,
})

let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-omitted-'))
  database = openDatabase(directory)
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

// A complete active scan that lists exactly these Tickets.
function completeScan(startedAt: number, listed: number[]) {
  const scanStartedAt = beginTicketScan(database, ACTIVE, startedAt)
  saveListedTickets(
    database,
    { ...SCOPE, scanStartedAt, offset: 0, readAt: Number.MAX_SAFE_INTEGER },
    listed.map((number) => ticket(number)),
  )
  completeTicketScan(database, ACTIVE, { statuses: [OPEN, DONE], completedAt: startedAt + 1 })
  return scanStartedAt
}

// What the provider answers for each native ID, and every ID it was asked.
function provider(answers: Record<string, TicketRead>) {
  const asked: string[] = []
  const readTicket = async (_request: unknown, id: string): Promise<TicketRead> => {
    asked.push(id)
    return answers[id] ?? { ok: false, failure: 'github-unreachable' }
  }
  return { asked, readTicket }
}

const failure = (code: TicketErrorCode): TicketRead => ({ ok: false, failure: code })

async function resolve(scanStartedAt: number, read: ReturnType<typeof provider>) {
  const changes: string[] = []
  await resolveOmittedTickets(
    { database, readTicket: read.readTicket, changed: ({ scope }) => changes.push(scope) },
    SCOPE,
    { accountId: ACCOUNT, scanStartedAt },
  )
  return changes
}

const keys = (read: { tickets: Ticket[] }) => read.tickets.map(({ key }) => key)
const page = { ...SCOPE, page: 0, pageSize: 25 }

test('an omitted Ticket that moved state is read by ID, leaves the active list and is not read again', async () => {
  completeScan(1000, [1, 2])
  const scanStartedAt = completeScan(2000, [1])
  const read = provider({ '#2': { ok: true, value: ticket(2, 'closed') } })

  const changes = await resolve(scanStartedAt, read)

  assert.deepEqual(read.asked, ['#2'])
  assert.deepEqual(changes, [SCOPE.scope])
  assert.deepEqual(keys(readActiveTickets(database, page)), ['#1'])
  const saved = readSavedTicket(database, { ...SCOPE, reference: '#2' }).saved
  assert.equal(saved?.ticket.state, 'closed')
  assert.equal(saved?.ticket.deleted, undefined)

  await resolve(completeScan(3000, [1]), read)
  assert.deepEqual(read.asked, ['#2'])
})

test('a provider-confirmed deletion keeps the Argo UUID, the title and the closed grouping', async () => {
  completeScan(1000, [1, 2])
  const before = readSavedTicket(database, { ...SCOPE, reference: '#2' }).saved
  const scanStartedAt = completeScan(2000, [1])

  await resolve(scanStartedAt, provider({ '#2': failure('ticket-deleted') }))

  const saved = readSavedTicket(database, { ...SCOPE, reference: '#2' }).saved
  assert.equal(saved?.argoId, before?.argoId)
  assert.equal(saved?.ticket.title, 'Ticket 2')
  assert.equal(saved?.ticket.state, 'closed')
  assert.equal(saved?.ticket.deleted, true)
  assert.deepEqual(keys(readActiveTickets(database, page)), ['#1'])
  assert.deepEqual(keys(readClosedTickets(database, page)), ['#2'])
})

test('a later read that finds a deleted Ticket again clears the deletion', async () => {
  completeScan(1000, [1, 2])
  await resolve(completeScan(2000, [1]), provider({ '#2': failure('ticket-deleted') }))
  completeScan(3000, [1, 2])

  const saved = readSavedTicket(database, { ...SCOPE, reference: '#2' }).saved
  assert.equal(saved?.ticket.deleted, undefined)
  assert.deepEqual(keys(readActiveTickets(database, page)), ['#1', '#2'])
})

test('a Ticket the provider says is not in this scope is kept and not marked deleted', async () => {
  completeScan(1000, [1, 2])
  const scanStartedAt = completeScan(2000, [1])

  await resolve(scanStartedAt, provider({ '#2': failure('ticket-not-found') }))

  const saved = readSavedTicket(database, { ...SCOPE, reference: '#2' }).saved
  assert.equal(saved?.ticket.deleted, undefined)
  assert.equal(saved?.ticket.state, 'open')
})

test('a read that settles nothing stops the resolution and leaves every omitted Ticket omitted', async () => {
  completeScan(1000, [1, 2, 3])
  const scanStartedAt = completeScan(2000, [1])
  const read = provider({ '#2': failure('rate-limited'), '#3': failure('ticket-deleted') })

  const changes = await resolve(scanStartedAt, read)

  assert.deepEqual(read.asked, ['#2'])
  assert.deepEqual(changes, [])
  for (const reference of ['#2', '#3']) {
    assert.equal(
      readSavedTicket(database, { ...SCOPE, reference }).saved?.ticket.deleted,
      undefined,
    )
  }
  const retry = provider({ '#2': failure('ticket-deleted'), '#3': failure('ticket-deleted') })
  await resolve(completeScan(3000, [1]), retry)
  assert.deepEqual(retry.asked, ['#2', '#3'])
})
