import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { openSharedDatabase } from './shared-database'

test('a Session remains when its Project is deleted', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-table-'))
  try {
    const database = openSharedDatabase(userData)
    database.exec('PRAGMA foreign_keys = ON')
    database
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', '/repo', '/repo/.git')
    database
      .prepare(
        'INSERT INTO session (argo_id, harness, native_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('argo-session-1', 'claude', 'native-1', 'project-1', 1234, 1234)

    database.prepare('DELETE FROM project WHERE id = ?').run('project-1')
    assert.deepEqual(
      Object.assign({}, database.prepare('SELECT argo_id, project_id FROM session').get()),
      { argo_id: 'argo-session-1', project_id: null },
    )
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
