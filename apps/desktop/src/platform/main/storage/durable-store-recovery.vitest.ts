import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, expect, test, vi } from 'vitest'
import { recoverDurableStore } from '@/platform/main/storage/durable-store-recovery'
import {
  backupSharedDatabase,
  openSharedDatabase,
  rebuildSharedDatabaseIndexes,
} from '@/platform/main/storage/shared-database'

const electron = vi.hoisted(() => ({
  exit: vi.fn(),
  showErrorBox: vi.fn(),
  showMessageBoxSync: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { exit: electron.exit },
  dialog: {
    showErrorBox: electron.showErrorBox,
    showMessageBoxSync: electron.showMessageBoxSync,
  },
}))

const roots: string[] = []
const migrationsFolder = path.resolve(import.meta.dirname, '../../../../drizzle')

afterEach(async () => {
  electron.exit.mockReset()
  electron.showErrorBox.mockReset()
  electron.showMessageBoxSync.mockReset()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function readDurableProject(databasePath: string): { id: string } {
  const database = new DatabaseSync(databasePath)
  try {
    return database.prepare('SELECT id FROM project').get() as { id: string }
  } finally {
    database.close()
  }
}

async function damagedDatabase(): Promise<{ backupPath: string; databasePath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-durable-store-recovery-'))
  roots.push(root)
  const databasePath = path.join(root, 'argo.sqlite')
  const backupPath = path.join(root, 'argo.backup.sqlite')
  const database = openSharedDatabase(root, migrationsFolder)
  database
    .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
    .run('project-1', '/tmp/project', '/tmp/project/.git')
  database
    .prepare('INSERT INTO session_search (harness, session_id, content) VALUES (?, ?, ?)')
    .run('codex', 'session-1', 'A disposable search record')
  await backupSharedDatabase(database, backupPath)
  database.close()
  await writeFile(databasePath, 'not a SQLite database')
  return { backupPath, databasePath }
}

test('keeps a damaged database in place when the user quits recovery', async () => {
  const { backupPath, databasePath } = await damagedDatabase()
  electron.showMessageBoxSync.mockReturnValue(1)
  const open = vi.fn(() => readDurableProject(databasePath))

  recoverDurableStore({ backupPath, databasePath, open })

  expect(open).toHaveBeenCalledOnce()
  expect(electron.exit).toHaveBeenCalledWith(1)
  expect(() => readDurableProject(databasePath)).toThrow()
})

test('restores the durable backup only after the user chooses Restore', async () => {
  const { backupPath, databasePath } = await damagedDatabase()
  electron.showMessageBoxSync.mockReturnValue(0)
  const open = vi.fn(() => readDurableProject(databasePath))

  expect(recoverDurableStore({ backupPath, databasePath, open })).toEqual({ id: 'project-1' })

  expect(open).toHaveBeenCalledTimes(2)
  expect(electron.exit).not.toHaveBeenCalled()
  const restored = new DatabaseSync(databasePath)
  rebuildSharedDatabaseIndexes(restored, migrationsFolder)
  expect(restored.prepare('SELECT id FROM project').all()).toEqual([{ id: 'project-1' }])
  expect(restored.prepare('SELECT content FROM session_search').all()).toEqual([])
  restored.close()
})
