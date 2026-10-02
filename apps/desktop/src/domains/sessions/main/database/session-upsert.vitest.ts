import assert from 'node:assert/strict'
import { test } from 'vitest'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import { createSessionUpsert } from './session-upsert'

function database() {
  const migrated = migratedDatabase()
  insertProject(migrated, 'project-1')
  return { client: migrated.$client, upsert: createSessionUpsert(migrated) }
}

test('keeps one Argo ID and preserves known metadata on a sparse upsert', () => {
  const { client, upsert } = database()
  try {
    const first = upsert({
      harness: 'claude',
      nativeId: 'native-1',
      projectId: 'project-1',
      worktreePath: '/work/argo',
      worktreeBranch: 'argo/session-1',
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
        'SELECT project_id, worktree_path, worktree_branch, custom_title, preview, first_prompt, cwd, activity_at FROM session WHERE argo_id = ?',
      )
      .get(first)
    assert.deepEqual(Object.assign({}, row), {
      project_id: 'project-1',
      worktree_path: '/work/argo',
      worktree_branch: 'argo/session-1',
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

test('a scan that read an older activity time never moves the row back (#3165)', () => {
  const { client, upsert } = database()
  try {
    const argoId = upsert({ harness: 'claude', nativeId: 'native-1', activityAt: 20 })
    upsert({ harness: 'claude', nativeId: 'native-1', activityAt: 10 })
    const activityAt = () =>
      (
        client.prepare('SELECT activity_at FROM session WHERE argo_id = ?').get(argoId) as {
          activity_at: number | null
        }
      ).activity_at
    assert.equal(activityAt(), 20)
    // A scan with no activity time keeps the known one.
    upsert({ harness: 'claude', nativeId: 'native-1', activityAt: null })
    assert.equal(activityAt(), 20)
    upsert({ harness: 'claude', nativeId: 'native-1', activityAt: 30 })
    assert.equal(activityAt(), 30)
  } finally {
    client.close()
  }
})
