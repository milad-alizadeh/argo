import assert from 'node:assert/strict'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { createActor } from 'xstate'
import type { Database } from '@/database/database'
import type { Harness } from '@/harnesses/harness'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { sessionSyncSupervisorMachine } from '../sync/session-sync-supervisor-machine'
import { SessionListChanges } from './session-list-changes'
import {
  observeSessionSync,
  type SessionSyncEvent,
  type SessionSyncStatus,
  savedSyncStatus,
  sessionSyncStatusProcedure,
} from './session-sync-status'

const idle: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}

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

test('saves completed scans while live phases stay in memory, and restarts a cut-short scan idle', () => {
  const database = migratedDatabase()
  const client = database.$client
  const { actor, report } = supervisor(database)
  try {
    const completed: SessionSyncStatus = {
      phase: 'ready',
      processed: 4,
      total: 4,
      skipped: 1,
      lastSuccessfulSyncAt: '2026-09-26T11:00:00.000Z',
      failure: null,
    }
    report('claude', completed)
    report('claude', { ...completed, phase: 'fetching', processed: 0, total: null })

    assert.equal(actor.getSnapshot().context.status.claude?.phase, 'fetching')
    assert.deepEqual(savedSyncStatus(database, 'claude'), completed)

    report('claude', {
      ...completed,
      phase: 'failed',
      processed: 2,
      failure: 'Claude unavailable',
      lastSuccessfulSyncAt: null,
    })
    assert.deepEqual(savedSyncStatus(database, 'claude'), {
      ...completed,
      phase: 'failed',
      processed: 2,
      failure: 'Claude unavailable',
    })

    client.exec("UPDATE session_sync_status SET phase = 'fetching'")
    const restarted = supervisor(database).actor
    assert.deepEqual(restarted.getSnapshot().context.status.claude, {
      ...completed,
      phase: 'idle',
      processed: 0,
      total: null,
      skipped: 0,
    })
    restarted.stop()
  } finally {
    actor.stop()
    client.close()
  }
})

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
    lastSuccessfulSyncAt: '2026-09-28T10:00:00.000Z',
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
