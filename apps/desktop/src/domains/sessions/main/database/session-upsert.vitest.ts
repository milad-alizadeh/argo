import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { createDurableDatabase } from '@/database/durable-database'
import { createSessionUpsert } from './session-upsert'

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    custom_title TEXT,
    preview TEXT,
    first_prompt TEXT,
    cwd TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  return { client, upsert: createSessionUpsert(createDurableDatabase(client)) }
}

test('keeps one Argo ID and preserves known metadata on a sparse upsert', () => {
  const { client, upsert } = database()
  try {
    const first = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      customTitle: 'Release notes',
      preview: 'A preview',
      firstPrompt: 'first',
      cwd: '/work/argo',
    })
    const repeated = upsert({
      harness: 'claude',
      nativeId: 'native-1',
    })
    assert.equal(repeated, first)
    const row = client
      .prepare(
        'SELECT project_id, custom_title, preview, first_prompt, cwd FROM session WHERE argo_id = ?',
      )
      .get(first)
    assert.deepEqual(Object.assign({}, row), {
      project_id: 'project-1',
      custom_title: 'Release notes',
      preview: 'A preview',
      first_prompt: 'first',
      cwd: '/work/argo',
    })
  } finally {
    client.close()
  }
})

test('clears an Argo title when the metadata source explicitly removes it', () => {
  const { client, upsert } = database()
  try {
    const argoId = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      customTitle: 'Release notes',
    })
    upsert({ harness: 'claude', nativeId: 'native-1', customTitle: null })
    const row = client
      .prepare('SELECT argo_id, custom_title FROM session WHERE argo_id = ?')
      .get(argoId)
    assert.deepEqual(Object.assign({}, row), { argo_id: argoId, custom_title: null })
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
      firstPrompt: 'first',
    })
    const fork = upsert({
      harness: 'codex',
      nativeId: 'thread-2',
      firstPrompt: 'first',
    })
    assert.notEqual(fork, original)
  } finally {
    client.close()
  }
})
