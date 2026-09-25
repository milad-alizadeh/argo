import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { databaseMigrationsFolder } from './migrations-folder'
import { openSharedDatabase, rebuildSharedDatabaseIndexes } from './shared-database'

async function temporaryUserData(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'argo-shared-database-startup-'))
}

const migrationsFolder = databaseMigrationsFolder()

test('starts a clean database with every ordered migration', async () => {
  const userData = await temporaryUserData()
  try {
    const database = openSharedDatabase(userData, migrationsFolder)

    expect(
      database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(),
    ).toEqual(
      expect.arrayContaining([
        { name: '__drizzle_migrations' },
        { name: 'project' },
        { name: 'project_selection' },
        { name: 'project_setup_checkpoint' },
        { name: 'project_setup_actor' },
        { name: 'project_setup_effect' },
        { name: 'project_setup_recovery' },
        { name: 'workspace' },
        { name: 'project_workspace_selection' },
        { name: 'managed_workspace_recovery' },
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
      { name: '20260921153754_low_ronan' },
      { name: '20260921153755_session_search' },
      { name: '20260921160623_sharp_silver_samurai' },
      { name: '20260921164243_aberrant_thundra' },
      { name: '20260921173714_demonic_meteorite' },
      { name: '20260921194635_worried_gargoyle' },
      { name: '20260921223050_tiresome_the_initiative' },
      { name: '20260924095908_wonderful_viper' },
      { name: '20260924100017_freezing_calypso' },
      { name: '20260924104032_bored_vulture' },
      { name: '20260925153614_centralize-session-table' },
      { name: '20260925164412_universal-timestamps' },
      { name: '20260925164424_touch-updated-at' },
    ])
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'managed_session_lease'",
        )
        .all(),
    ).toEqual([])
    database
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-constraint', '/tmp/constraint', '/tmp/constraint/.git')
    expect(() =>
      database.prepare('INSERT INTO project_selection (singleton) VALUES (?)').run(2),
    ).toThrow()
    expect(() =>
      database
        .prepare(
          'INSERT INTO project_setup_checkpoint (project_id, worktree_path, phase, configuration_source, document_revision) VALUES (?, ?, ?, ?, ?)',
        )
        .run('project-constraint', '/tmp/constraint', 'unknown', '{}', '1'),
    ).toThrow()
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('opens in WAL mode with a busy timeout, so a second worktree waits out a lock', async () => {
  const userData = await temporaryUserData()
  try {
    const database = openSharedDatabase(userData, migrationsFolder)
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
    const first = openSharedDatabase(userData, migrationsFolder)
    first
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', '/tmp/project', '/tmp/project/.git')
    first.close()

    const reopened = openSharedDatabase(userData, migrationsFolder)
    expect(reopened.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
    reopened.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('rebuilds disposable full-text search without deleting durable rows', async () => {
  const userData = await temporaryUserData()
  try {
    const database = openSharedDatabase(userData, migrationsFolder)
    database
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', '/tmp/project', '/tmp/project/.git')
    database
      .prepare(
        'INSERT INTO workspace (id, project_id, kind, display_name, path, base_ref) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        'workspace-1',
        'project-1',
        'managed',
        'Argo work',
        '/tmp/project/.argo/worktrees/argo-work',
        'origin/main',
      )
    database
      .prepare(
        'INSERT INTO managed_workspace_recovery (workspace_id, checkout_removed_at) VALUES (?, ?)',
      )
      .run('workspace-1', '2026-09-21T17:37:14.000Z')
    database
      .prepare('INSERT INTO session_search (harness, session_id, content) VALUES (?, ?, ?)')
      .run('codex', 'session-1', 'A disposable search record')

    rebuildSharedDatabaseIndexes(database, migrationsFolder)

    expect(database.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
    expect(database.prepare('SELECT workspace_id FROM managed_workspace_recovery').all()).toEqual([
      { workspace_id: 'workspace-1' },
    ])
    expect(database.prepare('SELECT content FROM session_search').all()).toEqual([])
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
