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
    project_id TEXT,
    vendor_title TEXT,
    working_directory TEXT,
    first_prompt TEXT,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  return { client, upsert: createSessionUpsert(createDurableDatabase(client)) }
}

test('preserves one Argo ID for repeated vendor identity', () => {
  const { client, upsert } = database()
  try {
    const first = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      firstPrompt: 'first',
    })
    const repeated = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      firstPrompt: 'later',
    })
    assert.equal(repeated, first)
    const row = client.prepare('SELECT project_id FROM session WHERE argo_id = ?').get(first)
    assert.equal(row?.project_id, 'project-1')
  } finally {
    client.close()
  }
})

test('keeps sparse discovery from erasing indexed vendor facts', () => {
  const { client, upsert } = database()
  try {
    const id = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: null,
      firstPrompt: 'first',
      vendorTitle: 'A vendor title',
      workingDirectory: '/repo',
    })
    upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: null,
      firstPrompt: null,
    })
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
  const { client, upsert } = database()
  try {
    upsert({
      harness: 'claude',
      nativeId: 'older',
      projectId: null,
      firstPrompt: null,
      updatedAt: 10,
    })
    upsert({
      harness: 'codex',
      nativeId: 'newer',
      projectId: null,
      firstPrompt: null,
      updatedAt: 20,
    })
    upsert({
      harness: 'claude',
      nativeId: 'older',
      projectId: null,
      firstPrompt: null,
      updatedAt: 10,
    })
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
  const { client, upsert } = database()
  try {
    const original = upsert({
      harness: 'codex',
      nativeId: 'thread-1',
      projectId: 'project-1',
      firstPrompt: 'first',
    })
    const fork = upsert({
      harness: 'codex',
      nativeId: 'thread-2',
      projectId: 'project-1',
      firstPrompt: 'first',
    })
    assert.notEqual(fork, original)
  } finally {
    client.close()
  }
})
