import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { databaseMigrationsFolder } from './migrations-folder'
import { openSharedDatabase } from './shared-database'

const latestMigration = '20260925153614_centralize-session-table'

test('migrates existing Session identity and title, and retains the row after Project deletion', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-session-migration-'))
  const legacyMigrations = path.join(userData, 'legacy-migrations')
  const migrations = databaseMigrationsFolder()
  try {
    await mkdir(legacyMigrations)
    const previousMigrations = (await readdir(migrations, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== latestMigration)
      .map((entry) => entry.name)
    for (const migration of previousMigrations)
      await cp(path.join(migrations, migration), path.join(legacyMigrations, migration), {
        recursive: true,
      })

    const beforeMigration = openSharedDatabase(userData, legacyMigrations)
    beforeMigration
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', '/repo', '/repo/.git')
    beforeMigration
      .prepare(
        'INSERT INTO session (argo_id, harness, native_id, project_id, title, first_prompt, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run('argo-session-1', 'claude', 'native-1', 'project-1', 'Kept title', 'Start here', 1234)
    beforeMigration.close()

    const afterMigration = openSharedDatabase(userData, migrations)
    afterMigration.exec('PRAGMA foreign_keys = ON')
    assert.deepEqual(
      Object.assign(
        {},
        afterMigration
          .prepare(
            'SELECT argo_id, custom_title, first_prompt, project_id, created_at FROM session',
          )
          .get(),
      ),
      {
        argo_id: 'argo-session-1',
        custom_title: 'Kept title',
        first_prompt: 'Start here',
        project_id: 'project-1',
        created_at: 1234,
      },
    )

    afterMigration.prepare('DELETE FROM project WHERE id = ?').run('project-1')
    assert.deepEqual(
      Object.assign({}, afterMigration.prepare('SELECT argo_id, project_id FROM session').get()),
      { argo_id: 'argo-session-1', project_id: null },
    )
    afterMigration.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
