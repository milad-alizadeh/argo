import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { SessionSyncStatusStore } from './session-sync-status'

test('persists Claude sync status for the next application process', () => {
  const client = new DatabaseSync(':memory:')
  client.exec(`
    CREATE TABLE session_sync_status (
      harness TEXT PRIMARY KEY,
      phase TEXT NOT NULL,
      processed INTEGER NOT NULL,
      total INTEGER,
      skipped INTEGER NOT NULL,
      last_successful_sync_at INTEGER,
      failure TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  const database = databaseFrom(client)
  const first = new SessionSyncStatusStore(database)
  const updated = {
    phase: 'ready' as const,
    processed: 4,
    total: 4,
    skipped: 1,
    lastSuccessfulSyncAt: '2026-09-26T11:00:00.000Z',
    failure: null,
  }

  first.update(updated)

  assert.deepEqual(new SessionSyncStatusStore(database).current(), updated)
})
