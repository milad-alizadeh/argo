import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import type { SessionIngestion } from '@/domains/sessions/contract/session-index'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { upsertSession } from './session-upsert'

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    vendor_title TEXT,
    working_directory TEXT,
    first_prompt TEXT,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  return { client, database: createDurableDatabase(client) }
}

function discoveredSession(overrides: Partial<SessionIngestion>): SessionIngestion {
  return {
    harness: 'claude',
    nativeId: 'native-1',
    vendorTitle: null,
    firstPrompt: null,
    updatedAt: 0,
    workingDirectory: null,
    ...overrides,
  }
}

test('preserves one Argo ID for repeated vendor identity', () => {
  const { client, database: durable } = database()
  try {
    const first = upsertSession(durable, discoveredSession({ firstPrompt: 'first' }), 'project-1')
    const repeated = upsertSession(
      durable,
      discoveredSession({ firstPrompt: 'later' }),
      'project-1',
    )
    assert.equal(repeated, first)
    const row = client.prepare('SELECT project_id FROM session WHERE argo_id = ?').get(first)
    assert.equal(row?.project_id, 'project-1')
  } finally {
    client.close()
  }
})

test('keeps sparse discovery from erasing indexed vendor facts', () => {
  const { client, database: durable } = database()
  try {
    const id = upsertSession(
      durable,
      discoveredSession({
        firstPrompt: 'first',
        vendorTitle: 'A vendor title',
        workingDirectory: '/repo',
      }),
      null,
    )
    upsertSession(durable, discoveredSession({ firstPrompt: null }), null)
    const row = client
      .prepare('SELECT argo_id, first_prompt, vendor_title, working_directory FROM session')
      .get()
    assert.deepEqual(
      { ...row },
      {
        argo_id: id,
        first_prompt: 'first',
        vendor_title: 'A vendor title',
        working_directory: '/repo',
      },
    )
  } finally {
    client.close()
  }
})

test('orders discovery by vendor activity rather than scan time', () => {
  const { client, database: durable } = database()
  try {
    upsertSession(durable, discoveredSession({ nativeId: 'older', updatedAt: 10 }), null)
    upsertSession(
      durable,
      discoveredSession({ harness: 'codex', nativeId: 'newer', updatedAt: 20 }),
      null,
    )
    upsertSession(durable, discoveredSession({ nativeId: 'older', updatedAt: 10 }), null)
    assert.deepEqual(
      client
        .prepare('SELECT native_id FROM session ORDER BY updated_at DESC')
        .all()
        .map((row) => ({ ...row })),
      [{ native_id: 'newer' }, { native_id: 'older' }],
    )
  } finally {
    client.close()
  }
})

test('assigns a separate Argo ID to a fork native ID', () => {
  const { client, database: durable } = database()
  try {
    const original = upsertSession(
      durable,
      discoveredSession({ harness: 'codex', nativeId: 'thread-1', firstPrompt: 'first' }),
      'project-1',
    )
    const fork = upsertSession(
      durable,
      discoveredSession({ harness: 'codex', nativeId: 'thread-2', firstPrompt: 'first' }),
      'project-1',
    )
    assert.notEqual(fork, original)
  } finally {
    client.close()
  }
})
