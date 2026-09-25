import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { databaseMigrationsFolder, openDatabase, rebuildDatabaseIndexes } from './database'

async function temporaryUserData(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'argo-database-startup-'))
}

const migrationsFolder = databaseMigrationsFolder()

test('starts a clean database with every ordered migration', async () => {
  const userData = await temporaryUserData()
  try {
    const database = openDatabase(userData, { migrationsFolder }).$client

    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(),
    ).toEqual(
      expect.arrayContaining([
        { name: '__drizzle_migrations' },
        { name: 'project' },
        { name: 'workspace' },
        { name: 'composer_draft' },
        { name: 'session_ticket_link' },
        { name: 'session' },
      ]),
    )
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_search'")
        .all(),
    ).toEqual([{ name: 'session_search' }])
    expect(database.prepare('SELECT name FROM __drizzle_migrations ORDER BY name').all()).toEqual([
      { name: '20260925212920_conscious_havok' },
      { name: '20260925212921_session_search' },
    ])
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND (name LIKE 'project_setup_%' OR name IN ('project_workspace_selection', 'managed_workspace_recovery'))",
        )
        .all(),
    ).toEqual([])
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('opens in WAL mode with a busy timeout, so a second worktree waits out a lock', async () => {
  const userData = await temporaryUserData()
  try {
    const database = openDatabase(userData, { migrationsFolder }).$client
    expect(database.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
    expect(database.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 })
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('keeps a migrated database on a normal restart', async () => {
  const userData = await temporaryUserData()
  try {
    const first = openDatabase(userData, { migrationsFolder }).$client
    first
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', '/tmp/project', '/tmp/project/.git')
    first.close()

    const reopened = openDatabase(userData, { migrationsFolder }).$client
    expect(reopened.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
    reopened.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('rebuilds disposable full-text search without deleting durable rows', async () => {
  const userData = await temporaryUserData()
  try {
    const opened = openDatabase(userData, { migrationsFolder })
    const database = opened.$client
    database
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', '/tmp/project', '/tmp/project/.git')
    database
      .prepare(
        'INSERT INTO workspace (id, project_id, kind, display_name, path) VALUES (?, ?, ?, ?, ?)',
      )
      .run('workspace-1', 'project-1', 'main', 'Main checkout', '/tmp/project')
    database
      .prepare('INSERT INTO session_search (harness, session_id, content) VALUES (?, ?, ?)')
      .run('codex', 'session-1', 'A disposable search record')

    rebuildDatabaseIndexes(opened, migrationsFolder)

    expect(database.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
    expect(database.prepare('SELECT id FROM workspace').all()).toEqual([{ id: 'workspace-1' }])
    expect(database.prepare('SELECT content FROM session_search').all()).toEqual([])
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
