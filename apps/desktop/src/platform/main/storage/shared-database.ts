import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createDurableDatabase } from './durable-database'
import { databaseMigrationsFolder } from './migrations-folder'
import { sharedDatabaseBackupPath, sharedDatabasePath } from './shared-database-path'
import { storageRunsPackagedApplication } from './storage-runtime'

export { sharedDatabaseBackupPath, sharedDatabasePath }

type DatabaseSync = import('node:sqlite').DatabaseSync

// createRequire needs a base path to resolve bare specifiers from, never `import.meta.url`:
// that token alone is a parse-time SyntaxError in the CommonJS-loaded contexts (Playwright's e2e
// fixtures, Bun) that also reach this module, even on a branch that never runs it (#2599).
function databaseRequire() {
  return createRequire(
    storageRunsPackagedApplication()
      ? path.join(process.resourcesPath, 'app.asar', 'package.json')
      : path.join(process.cwd(), 'package.json'),
  )
}

const SESSION_SEARCH_MIGRATION = '20260921153755_session_search'

function sqliteRuntime() {
  return databaseRequire()('node:sqlite') as typeof import('node:sqlite')
}

function migrateDatabase(database: DatabaseSync, migrationsFolder: string): void {
  const { migrate } = databaseRequire()(
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
