import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { createSessionUpsert } from './session-upsert'

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    first_prompt TEXT,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  return { client, upsert: createSessionUpsert(createDurableDatabase(client)) }
}

test('preserves one Argo ID for repeated vendor identity', () => {
  const { client, upsert } = database()
  try {
    const first = upsert({ harness: 'claude', nativeId: 'native-1', firstPrompt: 'first' })
    const repeated = upsert({ harness: 'claude', nativeId: 'native-1', firstPrompt: 'later' })
    assert.equal(repeated, first)
  } finally {
    client.close()
  }
})

test('assigns a separate Argo ID to a fork native ID', () => {
  const { client, upsert } = database()
  try {
    const original = upsert({ harness: 'codex', nativeId: 'thread-1', firstPrompt: 'first' })
    const fork = upsert({ harness: 'codex', nativeId: 'thread-2', firstPrompt: 'first' })
    assert.notEqual(fork, original)
  } finally {
    client.close()
  }
})
