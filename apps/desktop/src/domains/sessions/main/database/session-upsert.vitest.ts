import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { createSessionUpsert } from './upsert-session'

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    workspace_id TEXT,
    custom_title TEXT,
    preview TEXT,
    first_prompt TEXT,
    cwd TEXT,
    activity_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)),
    updated_at INTEGER NOT NULL DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER))
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  return { client, upsert: createSessionUpsert(databaseFrom(client)) }
}

test('keeps one Argo ID and preserves known metadata on a sparse upsert', () => {
  const { client, upsert } = database()
  try {
    const first = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      workspaceId: 'workspace-1',
      customTitle: 'Release notes',
      preview: 'A preview',
      firstPrompt: 'first',
      cwd: '/work/argo',
      activityAt: 10,
    })
    const repeated = upsert({
      harness: 'claude',
      nativeId: 'native-1',
    })
    assert.equal(repeated, first)
    const originalTimes = client
      .prepare('SELECT created_at, updated_at FROM session WHERE argo_id = ?')
      .get(first) as { created_at: number; updated_at: number }
    upsert({ harness: 'claude', nativeId: 'native-1' })
    const repeatedTimes = client
      .prepare('SELECT created_at, updated_at FROM session WHERE argo_id = ?')
      .get(first) as { created_at: number; updated_at: number }
    assert.equal(repeatedTimes.created_at, originalTimes.created_at)
    assert.ok(repeatedTimes.updated_at > originalTimes.updated_at)
    const row = client
      .prepare(
        'SELECT project_id, workspace_id, custom_title, preview, first_prompt, cwd, activity_at FROM session WHERE argo_id = ?',
      )
      .get(first)
    assert.deepEqual(Object.assign({}, row), {
      project_id: 'project-1',
      workspace_id: 'workspace-1',
      custom_title: 'Release notes',
      preview: 'A preview',
      first_prompt: 'first',
      cwd: '/work/argo',
      activity_at: 10,
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
