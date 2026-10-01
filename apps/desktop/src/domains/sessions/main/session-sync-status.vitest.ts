import assert from 'node:assert/strict'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { createActor } from 'xstate'
import type { Database } from '@/database/database'
import type { Harness } from '@/harnesses/harness'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { SessionListChanges } from './api'
import {
  IDLE_SESSION_SYNC_STATUS,
  observeSessionSync,
  type SessionSyncEvent,
  type SessionSyncStatus,
  sessionSyncStatusProcedure,
} from './session-sync-status'
import { sessionSyncSupervisorMachine } from './sync'

const idle = IDLE_SESSION_SYNC_STATUS

function supervisor(database: Database) {
  const actor = createActor(sessionSyncSupervisorMachine, {
    input: {
      database,
      changes: new SessionListChanges(),
      harnesses: {
        claude: {
          listSessionSummaries: async () => ({ records: [], skipped: 0 }),
          getSessionSummary: async () => null,
        },
      },
    },
  }).start()
  const report = (harness: Harness, status: SessionSyncStatus) =>
    actor.send({ type: 'SyncStatus', harness, status })
  return { actor, report }
}

test('one observer reports every Harness scan as one status, once per change', () => {
  const database = migratedDatabase()
  const { actor, report } = supervisor(database)
  const events: SessionSyncEvent[] = []
  const stop = observeSessionSync(actor, (event) => events.push(event))
  const ready = {
    ...idle,
    phase: 'ready',
    processed: 3,
    total: 3,
  } as const
  report('claude', ready)
  actor.send({ type: 'Discover', harness: 'claude', nativeId: 'native-1' })
  report('codex', { ...idle, phase: 'fetching', processed: 1, total: 4 })
  report('codex', {
    ...idle,
    phase: 'failed',
    processed: 2,
    total: 4,
    failure: 'Codex scan failed.',
  })
  stop()
  report('claude', { ...idle, phase: 'fetching' })
  actor.stop()
  database.$client.close()

  assert.deepEqual(events, [
    { type: 'status', status: idle },
    { type: 'status', status: ready },
    {
      type: 'status',
      status: { ...ready, phase: 'fetching', processed: 4, total: 7 },
    },
    {
      type: 'status',
      status: { ...ready, phase: 'failed', processed: 5, total: 7, failure: 'Codex scan failed.' },
    },
  ])
})

test('the renderer gets the current status, then each change', async () => {
  const database = migratedDatabase()
  const { actor, report } = supervisor(database)
  const caller = initTRPC
    .create()
    .router({ sync: sessionSyncStatusProcedure(actor) })
    .createCaller({})
  const events: SessionSyncEvent[] = []
  const subscription = (await caller.sync()).subscribe({ next: (event) => events.push(event) })
  report('claude', { ...idle, phase: 'fetching' })
  subscription.unsubscribe()
  actor.stop()
  database.$client.close()
  assert.deepEqual(events, [
    { type: 'status', status: idle },
    { type: 'status', status: { ...idle, phase: 'fetching' } },
  ])
})
