import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import {
  openSharedDatabase,
  rebuildSharedDatabaseIndexes,
  sharedDatabasePath,
} from '@/platform/main/storage/shared-database'

async function temporaryUserData(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'argo-shared-database-startup-'))
}

const migrationsFolder = path.resolve(import.meta.dirname, '../../../../drizzle')

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
        { name: 'session_ticket_link' },
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
    ])
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

test('resets the pre-cutover database once without deleting credentials', async () => {
  const userData = await temporaryUserData()
  try {
    const databasePath = sharedDatabasePath(userData)
    const credentialPath = path.join(userData, 'portable-v1', 'grants.json')
    await mkdir(path.dirname(credentialPath), { recursive: true })
    await writeFile(credentialPath, '{"credential":"keep"}')
    const legacy = new DatabaseSync(databasePath)
    legacy.exec('CREATE TABLE project (id TEXT PRIMARY KEY) STRICT')
    legacy.close()

    const database = openSharedDatabase(userData, migrationsFolder)
    expect(
      database.prepare('SELECT name FROM sqlite_master WHERE name = ?').all('project'),
    ).toEqual([{ name: 'project' }])
    database.close()
    await expect(readFile(credentialPath, 'utf8')).resolves.toBe('{"credential":"keep"}')
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
      .prepare('INSERT INTO session_search (harness, session_id, content) VALUES (?, ?, ?)')
      .run('codex', 'session-1', 'A disposable search record')

    rebuildSharedDatabaseIndexes(database, migrationsFolder)

    expect(database.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
    expect(database.prepare('SELECT content FROM session_search').all()).toEqual([])
    database.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
