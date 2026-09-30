import assert from 'node:assert/strict'
import { test } from 'vitest'
import { insertWorkspace, migratedDatabase } from '@/mocks/database/migrated-database'
import { createSessionUpsert } from './session-upsert'

function database() {
  const migrated = migratedDatabase()
  insertWorkspace(migrated, 'workspace-1', 'project-1')
  return { client: migrated.$client, upsert: createSessionUpsert(migrated) }
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
