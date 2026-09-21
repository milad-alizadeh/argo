import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { databaseMigrationsFolder } from '@/platform/main/storage/migrations-folder'
import {
  sharedDatabaseBackupPath,
  sharedDatabasePath,
} from '@/platform/main/storage/shared-database-path'

export { sharedDatabaseBackupPath, sharedDatabasePath }

type DatabaseSync = import('node:sqlite').DatabaseSync

const nodeRequire = createRequire(import.meta.url)

const SESSION_SEARCH_MIGRATION = '20260921153755_session_search'

function sqliteRuntime() {
  return nodeRequire('node:sqlite') as typeof import('node:sqlite')
}

function migrateDatabase(database: DatabaseSync, migrationsFolder: string): void {
  const { migrate } = nodeRequire(
    'drizzle-orm/node-sqlite/migrator',
  ) as typeof import('drizzle-orm/node-sqlite/migrator')
  migrate(createDurableDatabase(database), { migrationsFolder })
}

function packagedMigrationsFolder(): string {
  return databaseMigrationsFolder()
}

export function openSharedDatabase(
  userData: string,
  migrationsFolder: string = packagedMigrationsFolder(),
): DatabaseSync {
  mkdirSync(userData, { recursive: true })
  const { DatabaseSync } = sqliteRuntime()
  const database = new DatabaseSync(sharedDatabasePath(userData))
  migrateDatabase(database, migrationsFolder)
  return database
}

export function rebuildSharedDatabaseIndexes(
  database: DatabaseSync,
  migrationsFolder: string = packagedMigrationsFolder(),
): void {
  database.exec('DROP TABLE session_search')
  database.exec(
    readFileSync(path.join(migrationsFolder, SESSION_SEARCH_MIGRATION, 'migration.sql'), 'utf8'),
  )
}

export async function backupSharedDatabase(
  database: DatabaseSync,
  backupPath: string,
): Promise<void> {
  const { backup } = await import('node:sqlite')
  await backup(database, backupPath)
}

export function restoreSharedDatabase(databasePath: string, backupPath: string): boolean {
  if (!existsSync(backupPath)) return false
  copyFileSync(backupPath, databasePath)
  return true
}
