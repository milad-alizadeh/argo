import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { test } from 'vitest'
import type { Database } from '@/database/database'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketWriteIntent } from '@/database/ticket-write-intent/schema'
import type { TicketConnection } from '@/domains/connections/main'
import type { Ticket } from '@/domains/tickets/api/ticket'
import type { TicketRead } from '../sync'
import { DONE, SCOPE, seededDatabase, ticket } from './test-support/ticket-operation-test-fixtures'
import { accountForScopeFrom, reconcileTicketWriteIntents } from './ticket-write-intent-recovery'
import {
  markUnresolvedTicketWriteIntentsUncertain,
  recordIntent,
  settleIntent,
} from './ticket-write-intents'

const withDatabase = () => seededDatabase(['#1'])

const statusIntent = (key: string, statusId: string) => ({
  ...SCOPE,
  key,
  accountId: 'github:1',
  operation: 'status' as const,
  statusId,
})

// Records and settles an intent as `uncertain`, as recovery leaves one after a dropped call.
function leaveUncertain(database: Database, key: string): void {
  const recorded = recordIntent(database, statusIntent(key, 'done'))
  assert.ok(recorded.ok)
  settleIntent(database, {
    intentId: recorded.intentId,
    phase: 'uncertain',
    failure: 'connection-lost',
  })
}

const phases = (database: Database) =>
  database.select({ phase: ticketWriteIntent.phase }).from(ticketWriteIntent).all()

const savedStatus = (database: Database, key: string) => {
  const row = database
    .select({ statusJson: ticketContent.statusJson, listedAt: ticketContent.listedAt })
    .from(ticketContent)
    .where(eq(ticketContent.key, key))
    .get()
  return row === undefined
    ? undefined
    : { status: JSON.parse(row.statusJson) as Ticket['status'], listedAt: row.listedAt }
}

test('a pending intent left by a stopped process becomes uncertain', async () => {
  const database = await withDatabase()
  const recorded = recordIntent(database, statusIntent('#1', 'done'))
  assert.ok(recorded.ok)
  markUnresolvedTicketWriteIntentsUncertain(database)
  assert.deepEqual(phases(database), [{ phase: 'uncertain' }])
})

test("a provider read settles the intent and commits what it confirms, but doesn't unlist the Ticket", async () => {
  const database = await withDatabase()
  leaveUncertain(database, '#1')
  const changed: unknown[] = []
  await reconcileTicketWriteIntents({
    database,
    readTicket: async () => ({
      ok: true,
      value: { ...ticket('#1'), status: DONE, state: 'closed' },
    }),
    accountForScope: () => 'github:1',
    changed: (target) => changed.push(target),
  })
  assert.deepEqual(phases(database), [{ phase: 'committed' }])
  assert.equal(savedStatus(database, '#1')?.status.id, 'done')
  assert.notEqual(savedStatus(database, '#1')?.listedAt, null)
  assert.deepEqual(changed, [SCOPE])
})

test('a provider that no longer finds the Ticket settles the intent and unlists it', async () => {
  const database = await withDatabase()
  leaveUncertain(database, '#1')
  await reconcileTicketWriteIntents({
    database,
    readTicket: async (): Promise<TicketRead> => ({ ok: false, failure: 'ticket-not-found' }),
    accountForScope: () => 'github:1',
    changed: () => {},
  })
  assert.deepEqual(phases(database), [{ phase: 'committed' }])
  assert.equal(savedStatus(database, '#1')?.listedAt, null)
})

test('an unreachable provider leaves the intent uncertain for the next launch', async () => {
  const database = await withDatabase()
  leaveUncertain(database, '#1')
  let calls = 0
  await reconcileTicketWriteIntents({
    database,
    readTicket: async (): Promise<TicketRead> => {
      calls += 1
      return { ok: false, failure: 'github-unreachable' }
    },
    accountForScope: () => 'github:1',
    changed: () => {},
  })
  assert.equal(calls, 1)
  assert.deepEqual(phases(database), [{ phase: 'uncertain' }])
})

test('no connected Account for the scope is skipped without a read', async () => {
  const database = await withDatabase()
  leaveUncertain(database, '#1')
  let calls = 0
  await reconcileTicketWriteIntents({
    database,
    readTicket: async () => {
      calls += 1
      return { ok: true, value: ticket('#1') }
    },
    accountForScope: () => null,
    changed: () => {},
  })
  assert.equal(calls, 0)
  assert.deepEqual(phases(database), [{ phase: 'uncertain' }])
})

test('a new change is refused while an intent is still unresolved', async () => {
  const database = await withDatabase()
  leaveUncertain(database, '#1')
  const blocked = recordIntent(database, statusIntent('#1', 'started'))
  assert.deepEqual(blocked, { ok: false, reason: 'unreconciled' })
})

test("accountForScopeFrom answers the Account a scope's Connection names", () => {
  const connections: TicketConnection[] = [
    {
      projectId: 'p1',
      port: 'ticket',
      provider: 'github',
      accountId: 'github:1',
      scope: 'octocat/hello-world',
      label: 'hello-world',
    },
  ]
  const accountForScope = accountForScopeFrom(connections)
  assert.equal(accountForScope(SCOPE), 'github:1')
  assert.equal(accountForScope({ provider: 'github', scope: 'other/repo' }), null)
})
