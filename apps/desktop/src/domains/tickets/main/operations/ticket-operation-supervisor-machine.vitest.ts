import assert from 'node:assert/strict'
import { onTestFinished, test } from 'vitest'
import { createActor } from 'xstate'
import { ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import type { TicketStatus } from '@/domains/tickets/contract/contract'
import {
  DONE,
  SCOPE,
  savedStatus,
  seededDatabase,
} from './test-support/ticket-operation-test-fixtures'
import type { StatusWrite, TicketOperationDependencies } from './ticket-operation-machine'
import {
  changeTicketStatus,
  ticketOperationSupervisorMachine,
} from './ticket-operation-supervisor-machine'

const STARTED: TicketStatus = { id: 'started', name: 'Started', category: 'started' }

async function operations(writeStatus: TicketOperationDependencies['writeStatus']) {
  const database = await seededDatabase(['#1', '#2'])
  const announced: string[] = []
  const actor = createActor(ticketOperationSupervisorMachine, {
    input: { database, writeStatus, changed: ({ scope }) => announced.push(scope) },
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
  statusId,
})

test('changes to one Ticket run in arrival order, one at a time', async () => {
  const log: string[] = []
  const { actor } = await operations(async ({ statusId }) => {
    log.push(`start ${statusId}`)
    await new Promise((settle) => setTimeout(settle, 10))
    log.push(`end ${statusId}`)
    return { ok: true, status: statusId === 'started' ? STARTED : DONE }
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
  const { actor, database } = await operations(async (): Promise<StatusWrite> => {
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
  const { actor } = await operations(async (): Promise<StatusWrite> => {
    calls += 1
    return { ok: true, status: DONE }
  })
  const outcome = await changeTicketStatus(actor, request('#404', 'done'))
  assert.deepEqual(outcome, { type: 'rejected', failure: 'ticket-not-found' })
  assert.equal(calls, 0)
})

test('a second change is refused while the first is still uncertain, and never sent', async () => {
  let calls = 0
  const { actor } = await operations(async (): Promise<StatusWrite> => {
    calls += 1
    return { ok: false, failure: 'github-unreachable' }
  })
  const first = await changeTicketStatus(actor, request('#1', 'started'))
  assert.deepEqual(first, { type: 'uncertain', failure: 'github-unreachable' })
  const second = await changeTicketStatus(actor, request('#1', 'done'))
  assert.deepEqual(second, { type: 'rejected', failure: 'ticket-unreconciled' })
  assert.equal(calls, 1)
})
