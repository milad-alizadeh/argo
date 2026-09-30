import assert from 'node:assert/strict'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import {
  observeSessionSync,
  type SessionSyncEvent,
  type SessionSyncStatus,
  SessionSyncStatusStore,
  type SessionSyncStoreEvent,
  sessionSyncStatusProcedure,
} from './session-sync-status'

const ID = '00000000-0000-4000-8000-000000000001'
const OTHER_ID = '00000000-0000-4000-8000-000000000002'

test('persists completed results while live phases remain in memory', () => {
  const database = migratedDatabase()
  const client = database.$client
  try {
    const first = new SessionSyncStatusStore(database, 'claude')
    const completed: SessionSyncStatus = {
      phase: 'ready',
      processed: 4,
      total: 4,
      skipped: 1,
      lastSuccessfulSyncAt: '2026-09-26T11:00:00.000Z',
      failure: null,
    }
    first.update(completed)
    first.update({ ...completed, phase: 'fetching', processed: 0, total: null })

    assert.equal(first.current().phase, 'fetching')
    assert.deepEqual(new SessionSyncStatusStore(database, 'claude').current(), completed)

    first.update({
      ...completed,
      phase: 'failed',
      processed: 2,
      failure: 'Claude unavailable',
      lastSuccessfulSyncAt: null,
    })
    assert.deepEqual(new SessionSyncStatusStore(database, 'claude').current(), {
      ...completed,
      phase: 'failed',
      processed: 2,
      failure: 'Claude unavailable',
    })

    client.exec("UPDATE session_sync_status SET phase = 'fetching'")
    assert.deepEqual(new SessionSyncStatusStore(database, 'claude').current(), {
      ...completed,
      phase: 'idle',
      processed: 0,
      total: null,
      skipped: 0,
    })
  } finally {
    client.close()
  }
})

test('subscribers receive current status and a separate committed signal', () => {
  const store = new SessionSyncStatusStore(undefined, 'claude')
  const events: SessionSyncStoreEvent[] = []
  const unsubscribe = store.subscribe((event) => events.push(event))
  store.committed([ID])
  unsubscribe()
  assert.deepEqual(events.slice(1), [{ type: 'committed', sessionIds: [ID] }])
})

const idle: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}

test('one observer reports every Harness scan as one status and forwards each commit', () => {
  const first = new SessionSyncStatusStore(undefined, 'claude')
  const second = new SessionSyncStatusStore(undefined, 'codex')
  const events: SessionSyncEvent[] = []
  const stop = observeSessionSync([first, second], (event) => events.push(event))
  first.update({
    ...idle,
    phase: 'ready',
    processed: 3,
    total: 3,
    lastSuccessfulSyncAt: '2026-09-28T10:00:00.000Z',
  })
  second.update({ ...idle, phase: 'fetching', processed: 1, total: 4 })
  second.committed([ID])
  second.update({ ...idle, phase: 'failed', processed: 2, total: 4, failure: 'Codex scan failed.' })
  stop()
  first.committed([OTHER_ID])

  assert.deepEqual(events, [
    { type: 'status', status: idle },
    {
      type: 'status',
      status: {
        ...idle,
        phase: 'ready',
        processed: 3,
        total: 3,
        lastSuccessfulSyncAt: '2026-09-28T10:00:00.000Z',
      },
    },
    {
      type: 'status',
      status: {
        ...idle,
        phase: 'fetching',
        processed: 4,
        total: 7,
        lastSuccessfulSyncAt: '2026-09-28T10:00:00.000Z',
      },
    },
    { type: 'committed', sessionIds: [ID] },
    {
      type: 'status',
      status: {
        ...idle,
        phase: 'failed',
        processed: 5,
        total: 7,
        lastSuccessfulSyncAt: '2026-09-28T10:00:00.000Z',
        failure: 'Codex scan failed.',
      },
    },
  ])
})

test('the renderer gets a commit without Session IDs', async () => {
  const store = new SessionSyncStatusStore(undefined, 'claude')
  const caller = initTRPC
    .create()
    .router({ sync: sessionSyncStatusProcedure([store]) })
    .createCaller({})
  const events: SessionSyncEvent[] = []
  const subscription = (await caller.sync()).subscribe({ next: (event) => events.push(event) })
  store.committed([ID])
  subscription.unsubscribe()
  assert.deepEqual(events.slice(1), [{ type: 'committed' }])
})
