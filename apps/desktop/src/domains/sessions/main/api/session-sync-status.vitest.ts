import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import {
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
    const first = new SessionSyncStatusStore(database)
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
    assert.deepEqual(new SessionSyncStatusStore(database).current(), completed)

    first.update({
      ...completed,
      phase: 'failed',
      processed: 2,
      failure: 'Claude unavailable',
      lastSuccessfulSyncAt: null,
    })
    assert.deepEqual(new SessionSyncStatusStore(database).current(), {
      ...completed,
      phase: 'failed',
      processed: 2,
      failure: 'Claude unavailable',
    })

    client.exec("UPDATE session_sync_status SET phase = 'fetching'")
    assert.deepEqual(new SessionSyncStatusStore(database).current(), {
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
  const store = new SessionSyncStatusStore()
  const events: SessionSyncEvent[] = []
  const unsubscribe = store.subscribe((event) => events.push(event))
  store.committed()
  unsubscribe()
  assert.deepEqual(
    events.map((event) => event.type),
    ['status', 'committed'],
  )
})
