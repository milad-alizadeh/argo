import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { openSharedDatabase } from './shared-database'
import { tableTimestampPolicy } from './table-timestamp-policy'

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

test('database tables have an explicit timestamp policy', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-policy-'))
  try {
    const database = openSharedDatabase(userData)
    const tableNames = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'session_search%' AND name != '__drizzle_migrations' ORDER BY name",
      )
      .all()
      .map((row) => String(Object.values(row)[0]))
    assert.deepEqual(tableNames, Object.keys(tableTimestampPolicy).sort())

    for (const [tableName, timestampPolicy] of Object.entries(tableTimestampPolicy)) {
      if (timestampPolicy === 'none') continue
      const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
        name: string
        dflt_value: string | null
      }>
      for (const columnName of ['created_at', 'updated_at']) {
        const column = columns.find((candidate) => candidate.name === columnName)
        assert.ok(column, `${tableName}.${columnName} exists`)
        assert.match(column.dflt_value ?? '', /unixepoch\('subsec'\)/)
      }
      const trigger = database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?")
        .get(tableName)
      assert.ok(trigger, `${tableName} has a database timestamp trigger`)
    }
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('SQLite supplies timestamps on insert and advances updated_at on updates', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-timestamps-'))
  try {
    const database = openSharedDatabase(userData)
    database
      .prepare('INSERT INTO session (argo_id, harness, native_id) VALUES (?, ?, ?)')
      .run('argo-session-1', 'claude', 'native-1')
    const inserted = database
      .prepare('SELECT created_at, updated_at FROM session WHERE argo_id = ?')
      .get('argo-session-1') as { created_at: number; updated_at: number }
    assert.ok(inserted.created_at > 0)
    assert.equal(inserted.updated_at, inserted.created_at)

    database
      .prepare('UPDATE session SET custom_title = ? WHERE argo_id = ?')
      .run('Updated title', 'argo-session-1')
    const updated = database
      .prepare('SELECT created_at, updated_at FROM session WHERE argo_id = ?')
      .get('argo-session-1') as { created_at: number; updated_at: number }
    assert.equal(updated.created_at, inserted.created_at)
    assert.ok(updated.updated_at > inserted.updated_at)
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
