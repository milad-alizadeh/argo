import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import {
  observeSessionSync,
  type SessionSyncEvent,
  type SessionSyncStatus,
  SessionSyncStatusStore,
} from './session-sync-status'

test('persists completed results while live phases remain in memory', () => {
  const client = new DatabaseSync(':memory:')
  try {
    client.exec(`CREATE TABLE session_sync_status (
      harness TEXT PRIMARY KEY,
      phase TEXT NOT NULL,
      processed INTEGER NOT NULL,
      total INTEGER,
      skipped INTEGER NOT NULL,
      last_successful_sync_at INTEGER,
      failure TEXT,
      created_at INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL DEFAULT 1
    )`)
    const database = databaseFrom(client)
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
  const events: SessionSyncEvent[] = []
  const unsubscribe = store.subscribe((event) => events.push(event))
  store.committed()
  unsubscribe()
  assert.deepEqual(
    events.map((event) => event.type),
    ['status', 'committed'],
  )
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
  second.committed()
  second.update({ ...idle, phase: 'failed', processed: 2, total: 4, failure: 'Codex scan failed.' })
  stop()
  first.committed()

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
    { type: 'committed' },
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
