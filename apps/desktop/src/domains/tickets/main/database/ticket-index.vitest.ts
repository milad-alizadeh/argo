import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, test } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import type { Ticket, TicketStatus } from '@/domains/tickets/contract/contract'
import {
  beginTicketScan,
  completeTicketScan,
  failTicketScan,
  markInterruptedTicketScans,
} from '../sync/ticket-sync-records'
import { readActiveTickets } from './ticket-queries'
import { saveConfirmedFields, saveListedTickets } from './ticket-upsert'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const NOT_PLANNED: TicketStatus = {
  id: 'not_planned',
  name: 'Closed as not planned',
  category: 'canceled',
}
const SCOPE = { provider: 'github', scope: 'octocat/hello-world' } as const
const ACTIVE = { ...SCOPE, kind: 'active' } as const

function ticket(number: number, title = `Ticket ${number}`): Ticket {
  return {
    key: `#${number}`,
    url: `https://github.com/octocat/hello-world/issues/${number}`,
    title,
    body: null,
    state: 'open',
    status: OPEN,
    priority: null,
    createdAt: '2026-09-01T00:00:00Z',
    labels: [{ name: 'wayfinder', color: '5319e7' }],
    type: null,
    children: [],
    blockedBy: null,
  }
}

let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-index-'))
  database = openDatabase(directory)
})

afterEach(async () => {
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
})

// Pages read after every earlier write, unless a case says when its page was asked for.
function scan(startedAt: number, pages: Ticket[][], readAt = Number.MAX_SAFE_INTEGER) {
  beginTicketScan(database, ACTIVE, startedAt)
  let offset = 0
  for (const page of pages) {
    saveListedTickets(database, { ...SCOPE, scanStartedAt: startedAt, offset, readAt }, page)
    offset += page.length
  }
}

const argoIds = () =>
  Object.fromEntries(
    database.$client
      .prepare(
        'SELECT native_id, argo_id FROM ticket WHERE provider = ? AND scope = ? ORDER BY native_id',
      )
      .all(SCOPE.provider, SCOPE.scope)
      .map((row) => [String(row.native_id), String(row.argo_id)]),
  )

const active = (page = 0, pageSize = 25) =>
  readActiveTickets(database, { ...SCOPE, page, pageSize })

test('a complete scan commits Tickets that keep their Argo UUID across later scans', () => {
  scan(1000, [[ticket(609), ticket(607)], [ticket(273)]])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN, NOT_PLANNED], completedAt: 1500 })
  const first = argoIds()
  assert.deepEqual(Object.keys(first), ['#273', '#607', '#609'])

  scan(2000, [[ticket(609, 'Renamed on GitHub'), ticket(607), ticket(273)]])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN, NOT_PLANNED], completedAt: 2500 })

  assert.deepEqual(argoIds(), first)
  const read = active()
  assert.deepEqual(
    read.tickets.map(({ key, title }) => [key, title]),
    [
      ['#609', 'Renamed on GitHub'],
      ['#607', 'Ticket 607'],
      ['#273', 'Ticket 273'],
    ],
  )
  assert.deepEqual(read.tickets[0], { ...ticket(609, 'Renamed on GitHub') })
  assert.deepEqual(read.statuses, [OPEN, NOT_PLANNED])
  assert.deepEqual(read.sync, {
    phase: 'ready',
    failure: null,
    complete: true,
    completedAt: 2500,
  })
})

test('an unfinished scan adds what it read but is never complete coverage', () => {
  scan(1000, [[ticket(1), ticket(2)]])
  const read = active()
  assert.deepEqual(
    read.tickets.map(({ key }) => key),
    ['#1', '#2'],
  )
  assert.equal(read.sync.phase, 'syncing')
  assert.equal(read.sync.complete, false)
})

test('only a complete scan drops Tickets it no longer listed; a failed one changes nothing', () => {
  scan(1000, [[ticket(1), ticket(2), ticket(3)]])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN], completedAt: 1100 })

  scan(2000, [[ticket(1)]])
  failTicketScan(database, ACTIVE, 'github-unreachable')
  let read = active()
  assert.deepEqual(
    read.tickets.map(({ key }) => key),
    ['#1', '#2', '#3'],
  )
  assert.deepEqual(read.sync, {
    phase: 'failed',
    failure: 'github-unreachable',
    complete: true,
    completedAt: 1100,
  })

  scan(3000, [[ticket(1), ticket(3)]])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN], completedAt: 3100 })
  read = active()
  assert.deepEqual(
    read.tickets.map(({ key }) => key),
    ['#1', '#3'],
  )
  // The omitted Ticket keeps its identity and its last known facts.
  assert.equal(Object.keys(argoIds()).includes('#2'), true)
})

test('the active list is read in numbered pages with its indexed total', () => {
  scan(1000, [Array.from({ length: 5 }, (_, index) => ticket(index + 1))])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN], completedAt: 1100 })
  const second = active(1, 2)
  assert.deepEqual(
    second.tickets.map(({ key }) => key),
    ['#3', '#4'],
  )
  assert.equal(second.total, 5)
  assert.deepEqual(
    active(2, 2).tickets.map(({ key }) => key),
    ['#5'],
  )
})

test('a confirmed status stays on the listed row until a scan omits it', () => {
  scan(1000, [[ticket(1), ticket(2)]])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN, NOT_PLANNED], completedAt: 1100 })
  saveConfirmedFields(database, { ...SCOPE, key: '#2' }, { status: NOT_PLANNED, state: 'closed' })
  const closed = active().tickets.find(({ key }) => key === '#2')
  assert.deepEqual(closed?.status, NOT_PLANNED)
  assert.equal(closed?.state, 'closed')
})

test('a page asked for before a confirmed write lists the Ticket but keeps the confirmed fields', () => {
  scan(1000, [[ticket(1), ticket(2)]])
  saveConfirmedFields(database, { ...SCOPE, key: '#2' }, { status: NOT_PLANNED, state: 'closed' })
  scan(2000, [[ticket(2, 'Renamed'), ticket(1), ticket(3)]], 0)
  completeTicketScan(database, ACTIVE, { statuses: [OPEN, NOT_PLANNED], completedAt: 2100 })
  const read = active().tickets
  assert.deepEqual(
    read.map(({ key }) => key),
    ['#2', '#1', '#3'],
  )
  assert.deepEqual(read[0]?.status, NOT_PLANNED)
  assert.equal(read[0]?.title, 'Ticket 2')
})

test('another scope reads none of these Tickets', () => {
  scan(1000, [[ticket(1)]])
  completeTicketScan(database, ACTIVE, { statuses: [OPEN], completedAt: 1100 })
  const other = readActiveTickets(database, {
    provider: 'github',
    scope: 'octocat/other',
    page: 0,
    pageSize: 25,
  })
  assert.deepEqual(other.tickets, [])
  assert.deepEqual(other.sync, { phase: 'idle', failure: null, complete: false, completedAt: null })
})

test('a scan the app was stopped during reads as idle after restart', () => {
  scan(1000, [[ticket(1)]])
  markInterruptedTicketScans(database)
  assert.equal(active().sync.phase, 'idle')
})
