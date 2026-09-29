import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'vitest'
import { createActor } from 'xstate'
import { type Database, openDatabase } from '@/database/database'
import type { Ticket, TicketStatus } from '@/domains/tickets/api/messages'
import {
  readActiveTickets,
  readClosedTickets,
  readSavedTicket,
  readSearchedTickets,
} from '../database/ticket-queries'
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

const ticket = (
  number: number,
  title = `Ticket ${number}`,
  state: Ticket['state'] = 'open',
): Ticket => ({
  key: `#${number}`,
  url: null,
  title,
  body: null,
  state,
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
      readTicket: readNoTicket,
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
      readTicket: readNoTicket,
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
// A Ticket read that settles nothing, for scans that omit no Ticket.
const readNoTicket: TicketSyncDependencies['readTicket'] = async () => ({
  ok: false,
  failure: 'github-unreachable',
})
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
    input: { database, readPage, readTicket: readNoTicket, changed: () => {}, timing },
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

const DONE: TicketStatus = { id: 'done', name: 'Done', category: 'completed' }
const closedTicket = (number: number): Ticket => ({
  ...ticket(number),
  state: 'closed',
  status: DONE,
})
const closedPage = (numbers: number[], nextCursor: string | null): PageRead => ({
  ok: true,
  value: { tickets: numbers.map(closedTicket), statuses: [], nextCursor, total: null },
})
const savedClosed = () =>
  readClosedTickets(database, { provider: 'github', scope: REQUEST.scope, page: 0, pageSize: 25 })
const closedKeys = () => savedClosed().tickets.map(({ key }) => key)

function closedSupervisor(reads: Record<string, PageRead>) {
  const asked: { cursor: string | null; state: string | undefined }[] = []
  const supervisor = createActor(ticketSyncSupervisorMachine, {
    input: {
      database,
      readTicket: readNoTicket,
      readPage: async (request, cursor) => {
        asked.push({ cursor, state: request.state })
        return reads[cursor ?? 'first'] ?? { ok: false, failure: 'github-unreachable' }
      },
      timing: TICKET_SYNC_TIMING,
      changed: () => {},
    },
  }).start()
  // A person opening Closed, or asking for more of it, then waiting for the answer to commit.
  const ask = async (more: boolean, answered: () => boolean) => {
    supervisor.send({ type: 'LoadClosed', request: REQUEST, more })
    await until(answered)
  }
  return { supervisor, asked, ask }
}

const PAGES = () => ({ first: closedPage([9, 8], '2'), '2': closedPage([7], null) })
const loaded = () => savedClosed().sync.phase === 'ready'
const complete = () => savedClosed().sync.complete

test('Closed reads a page when opened and the next on request, apart from the active scan', async () => {
  const { supervisor, asked, ask } = closedSupervisor(PAGES())
  await ask(false, loaded)
  assert.deepEqual(closedKeys(), ['#9', '#8'])
  assert.equal(complete(), false)

  await ask(true, complete)
  assert.deepEqual(closedKeys(), ['#9', '#8', '#7'])
  assert.deepEqual(asked, [
    { cursor: null, state: 'closed' },
    { cursor: '2', state: 'closed' },
  ])
  // The saved Closed Tickets never joined the active list.
  assert.equal(read().total, 0)

  // Past the last page nothing is read.
  supervisor.send({ type: 'LoadClosed', request: REQUEST, more: true })
  await new Promise((settle) => setTimeout(settle, 20))
  assert.equal(asked.length, 2)

  // Opening Closed again starts the listing over from the first page.
  await ask(false, () => !complete() && loaded())
  assert.deepEqual(closedKeys(), ['#9', '#8'])
  supervisor.stop()
})

test('a failed Closed page keeps the saved rows, waits for a person, and can be asked again', async () => {
  const reads: Record<string, PageRead> = { first: closedPage([9, 8], '2') }
  const { supervisor, asked, ask } = closedSupervisor(reads)
  await ask(false, loaded)
  await ask(true, () => savedClosed().sync.phase === 'failed')
  assert.equal(savedClosed().sync.failure, 'github-unreachable')
  assert.deepEqual(closedKeys(), ['#9', '#8'])
  await new Promise((settle) => setTimeout(settle, 20))
  assert.equal(asked.length, 2)

  reads['2'] = closedPage([7], null)
  await ask(true, complete)
  assert.deepEqual(closedKeys(), ['#9', '#8', '#7'])
  assert.equal(savedClosed().sync.failure, null)
  supervisor.stop()
})

test('the wait after a scan is the poll, or the doubled retry up to its bound', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 6, 50].map((failures) => nextScanDelay(TICKET_SYNC_TIMING, failures)),
    [60_000, 5_000, 10_000, 20_000, 160_000, 300_000],
  )
})

const search = (query: string) =>
  readSearchedTickets(database, {
    provider: 'github',
    scope: REQUEST.scope,
    query,
    page: 0,
    pageSize: 25,
  })

function supervisorReading(readPage: (query: string) => Promise<PageRead>) {
  const supervisor = createActor(ticketSyncSupervisorMachine, {
    input: {
      database,
      readTicket: readNoTicket,
      readPage: (request) => readPage(request.query),
      timing: TICKET_SYNC_TIMING,
      changed: () => {},
    },
  }).start()
  return { supervisor }
}

const page = (...tickets: Ticket[]): PageRead => ({
  ok: true,
  value: { tickets, statuses: [OPEN], nextCursor: null, total: null },
})

test('saved Tickets answer a query before the provider does, and the provider adds its own after', async () => {
  const { supervisor } = supervisorReading(async (query) =>
    query === ''
      ? page(ticket(9, 'History of the roadmap'))
      : page(ticket(10, 'Old history', 'closed')),
  )
  supervisor.send({ type: 'Sync', request: REQUEST })
  await until(
    () =>
      readActiveTickets(database, {
        provider: 'github',
        scope: REQUEST.scope,
        page: 0,
        pageSize: 5,
      }).sync.complete,
  )

  const before = search('history')
  assert.equal(before.search.phase, 'idle')
  assert.deepEqual(
    before.tickets.map(({ key }) => key),
    ['#9'],
  )

  supervisor.send({ type: 'Search', request: { ...REQUEST, query: 'history' } })
  await until(() => search('history').search.completedAt !== null)
  assert.deepEqual(
    search('history').tickets.map(({ key }) => key),
    ['#10', '#9'],
  )
  supervisor.stop()
})

test('a provider-only match is committed under the same identity the detail reads', async () => {
  const { supervisor } = supervisorReading(async (query) =>
    query === 'roadmap' ? page(ticket(4, 'Quarterly plan', 'closed')) : page(),
  )
  supervisor.send({ type: 'Search', request: { ...REQUEST, query: 'roadmap' } })
  await until(() => search('roadmap').search.completedAt !== null)

  const found = search('roadmap')
  assert.equal(found.search.phase, 'ready')
  assert.deepEqual(
    found.tickets.map(({ title }) => title),
    ['Quarterly plan'],
  )
  assert.equal(found.total, 1)
  const detail = readSavedTicket(database, {
    provider: 'github',
    scope: REQUEST.scope,
    reference: '#4',
  })
  assert.equal(detail.saved?.ticket.title, 'Quarterly plan')
  // Unlisted, so the active list is unchanged.
  assert.equal(
    readActiveTickets(database, { provider: 'github', scope: REQUEST.scope, page: 0, pageSize: 5 })
      .total,
    0,
  )
  supervisor.stop()
})

test('a failed provider search keeps the saved matches and names the failure', async () => {
  const { supervisor } = supervisorReading(async (query) =>
    query === 'first'
      ? page(ticket(1, 'First match'))
      : { ok: false, failure: 'github-unreachable' },
  )
  supervisor.send({ type: 'Search', request: { ...REQUEST, query: 'first' } })
  await until(() => search('first').search.completedAt !== null)
  supervisor.send({ type: 'Search', request: { ...REQUEST, query: 'match' } })
  await until(() => search('match').search.phase === 'failed')

  const failed = search('match')
  assert.equal(failed.search.failure, 'github-unreachable')
  assert.equal(failed.search.completedAt, null)
  assert.deepEqual(
    failed.tickets.map(({ key }) => key),
    ['#1'],
  )
  supervisor.stop()
})

test('a query holding SQL wildcards matches only itself', async () => {
  const { supervisor } = supervisorReading(async () =>
    page(ticket(1, '100% done'), ticket(2, '100 items')),
  )
  supervisor.send({ type: 'Search', request: { ...REQUEST, query: 'zzz' } })
  await until(() => search('zzz').search.completedAt !== null)
  assert.deepEqual(
    search('100%').tickets.map(({ key }) => key),
    ['#1'],
  )
  assert.deepEqual(
    search('_').tickets.map(({ key }) => key),
    [],
  )
  supervisor.stop()
})
