import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { onTestFinished, test } from 'vitest'
import { createActor } from 'xstate'
import { type Database, openDatabase } from '@/database/database'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/api/messages'
import { saveListedTickets } from '../database/ticket-upsert'
import type { TicketOperationDependencies, TicketWrite } from './ticket-operation-machine'
import {
  changeTicketPriority,
  changeTicketStatus,
  ticketOperationSupervisorMachine,
} from './ticket-operation-supervisor-machine'

const OPEN: TicketStatus = { id: 'open', name: 'Open', category: 'unstarted' }
const STARTED: TicketStatus = { id: 'started', name: 'Started', category: 'started' }
const DONE: TicketStatus = { id: 'done', name: 'Done', category: 'completed' }
const HIGH: TicketPriority = { level: 2, label: 'High' }
const SCOPE = { provider: 'github', scope: 'octocat/hello-world' } as const

const ticket = (key: string): Ticket => ({
  key,
  url: null,
  title: `Ticket ${key}`,
  body: null,
  state: 'open',
  status: OPEN,
  priority: null,
  createdAt: '2026-09-29T00:00:00Z',
  labels: [],
  type: null,
  children: [],
  blockedBy: null,
})

async function operations(write: TicketOperationDependencies['write']) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-operations-'))
  onTestFinished(() => rm(directory, { force: true, recursive: true }))
  const database = openDatabase(directory)
  onTestFinished(() => database.$client.close())
  saveListedTickets(database, { ...SCOPE, scanStartedAt: 1, offset: 0, readAt: Date.now() }, [
    ticket('#1'),
    ticket('#2'),
  ])
  const announced: string[] = []
  const actor = createActor(ticketOperationSupervisorMachine, {
    input: { database, write, changed: ({ scope }) => announced.push(scope) },
  }).start()
  onTestFinished(() => {
    actor.stop()
  })
  return { database, actor, announced }
}

const request = (key: string, statusId: string) => ({
  ...SCOPE,
  accountId: 'github:1',
  key,
  operation: 'status' as const,
  statusId,
})

const savedStatus = (database: Database, key: string) => {
  const row = database
    .select({ statusJson: ticketContent.statusJson })
    .from(ticketContent)
    .where(eq(ticketContent.key, key))
    .get()
  return row === undefined ? undefined : (JSON.parse(row.statusJson) as TicketStatus)
}

test('changes to one Ticket run in arrival order, one at a time', async () => {
  const log: string[] = []
  const { actor } = await operations(async (change) => {
    const statusId = change.operation === 'status' ? change.statusId : ''
    log.push(`start ${statusId}`)
    await new Promise((settle) => setTimeout(settle, 10))
    log.push(`end ${statusId}`)
    return {
      ok: true,
      confirmed: { operation: 'status', status: statusId === 'started' ? STARTED : DONE },
    }
  })
  const outcomes = await Promise.all([
    changeTicketStatus(actor, request('#1', 'started')),
    changeTicketStatus(actor, request('#1', 'done')),
  ])
  assert.deepEqual(log, ['start started', 'end started', 'start done', 'end done'])
  assert.deepEqual(
    outcomes.map(({ type }) => type),
    ['committed', 'committed'],
  )
})

test('a refused change is recorded as rejected and never announced', async () => {
  const { actor, database, announced } = await operations(async () => ({
    ok: false,
    failure: 'ticket-not-writable',
  }))
  const outcome = await changeTicketStatus(actor, request('#1', 'done'))
  assert.deepEqual(outcome, { type: 'rejected', failure: 'ticket-not-writable' })
  assert.deepEqual(announced, [])
  assert.equal(savedStatus(database, '#1')?.id, 'open')
  assert.deepEqual(
    database
      .select({ phase: ticketWriteIntent.phase, failure: ticketWriteIntent.failure })
      .from(ticketWriteIntent)
      .all(),
    [{ phase: 'rejected', failure: 'ticket-not-writable' }],
  )
})

test('an unreachable provider leaves the change uncertain and sends it once', async () => {
  let calls = 0
  const { actor, database } = await operations(async (): Promise<TicketWrite> => {
    calls += 1
    return { ok: false, failure: 'github-unreachable' }
  })
  const outcome = await changeTicketStatus(actor, request('#1', 'done'))
  assert.deepEqual(outcome, { type: 'uncertain', failure: 'github-unreachable' })
  assert.equal(calls, 1)
  assert.equal(savedStatus(database, '#1')?.id, 'open')
  assert.deepEqual(
    database.select({ phase: ticketWriteIntent.phase }).from(ticketWriteIntent).all(),
    [{ phase: 'uncertain' }],
  )
})

test('a Ticket Argo has not saved is refused before the provider is asked', async () => {
  let calls = 0
  const { actor } = await operations(async (): Promise<TicketWrite> => {
    calls += 1
    return { ok: true, confirmed: { operation: 'status', status: DONE } }
  })
  const outcome = await changeTicketStatus(actor, request('#404', 'done'))
  assert.deepEqual(outcome, { type: 'rejected', failure: 'ticket-not-found' })
  assert.equal(calls, 0)
})

const savedPriority = (database: Database, key: string) => {
  const row = database
    .select({ priorityJson: ticketContent.priorityJson })
    .from(ticketContent)
    .where(eq(ticketContent.key, key))
    .get()
  return row?.priorityJson ? (JSON.parse(row.priorityJson) as TicketPriority) : null
}

const priorityRequest = (key: string, priorityLevel: 1 | 2 | 3 | 4 | null) => ({
  ...SCOPE,
  accountId: 'github:1',
  key,
  operation: 'priority' as const,
  priorityLevel,
})

test('a confirmed priority is committed, announced and settled', async () => {
  const { actor, database, announced } = await operations(async () => ({
    ok: true,
    confirmed: { operation: 'priority', priority: HIGH },
  }))
  const outcome = await changeTicketPriority(actor, priorityRequest('#1', 2))
  assert.deepEqual(outcome, {
    type: 'committed',
    confirmed: { operation: 'priority', priority: HIGH },
  })
  assert.deepEqual(savedPriority(database, '#1'), HIGH)
  assert.deepEqual(announced, [SCOPE.scope])
  assert.deepEqual(
    database
      .select({ operation: ticketWriteIntent.operation, phase: ticketWriteIntent.phase })
      .from(ticketWriteIntent)
      .all(),
    [{ operation: 'priority', phase: 'committed' }],
  )
})

test('a refused priority keeps the committed value and announces nothing', async () => {
  const { actor, database, announced } = await operations(async () => ({
    ok: false,
    failure: 'ticket-not-writable',
  }))
  const outcome = await changeTicketPriority(actor, priorityRequest('#1', 1))
  assert.deepEqual(outcome, { type: 'rejected', failure: 'ticket-not-writable' })
  assert.equal(savedPriority(database, '#1'), null)
  assert.deepEqual(announced, [])
})
