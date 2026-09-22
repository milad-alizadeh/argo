import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import {
  backupSharedDatabase,
  restoreSharedDatabase,
  sharedDatabaseBackupPath,
  sharedDatabasePath,
} from '@/platform/main/storage/shared-database'

async function temporaryUserData(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'argo-shared-database-'))
}

test('restores durable rows from the automatic backup after database corruption', async () => {
  const userData = await temporaryUserData()
  try {
    const databasePath = sharedDatabasePath(userData)
    const database = new DatabaseSync(databasePath)
    database.exec('CREATE TABLE project (id TEXT PRIMARY KEY) STRICT')
    database.prepare('INSERT INTO project (id) VALUES (?)').run('project-1')
    await backupSharedDatabase(database, sharedDatabaseBackupPath(userData))
    database.close()

    await writeFile(databasePath, 'not a SQLite database', 'utf8')

    expect(restoreSharedDatabase(databasePath, sharedDatabaseBackupPath(userData))).toBe(true)
    const restored = new DatabaseSync(databasePath)
    expect(restored.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
    restored.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
