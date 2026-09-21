import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/node-sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'

const MIGRATIONS_TABLE = '__drizzle_migrations'
const LEGACY_TABLES = [
  'project',
  'project_selection',
  'project_setup_checkpoint',
  'session_ticket_link',
]
const SESSION_SEARCH_MIGRATION = '20260921153755_session_search'

function packagedMigrationsFolder(): string {
  return path.resolve(import.meta.dirname, '..', '..', 'drizzle')
}

function hasPreCutoverSchema(databasePath: string): boolean {
  if (!existsSync(databasePath)) return false
  const database = new DatabaseSync(databasePath)
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[]
    if (tables.some((table) => table.name === MIGRATIONS_TABLE)) return false
    return tables.some((table) => LEGACY_TABLES.includes(table.name))
  } finally {
    database.close()
  }
}

function resetPreCutoverSchema(databasePath: string): void {
  rmSync(databasePath, { force: true })
  rmSync(`${databasePath}-shm`, { force: true })
  rmSync(`${databasePath}-wal`, { force: true })
}

export function sharedDatabasePath(userData: string): string {
  return path.join(userData, 'argo.sqlite')
}

export function sharedDatabaseBackupPath(userData: string): string {
  return path.join(userData, 'argo.backup.sqlite')
}

export function openSharedDatabase(
  userData: string,
  migrationsFolder: string = packagedMigrationsFolder(),
): DatabaseSync {
  mkdirSync(userData, { recursive: true })
  const databasePath = sharedDatabasePath(userData)
  if (hasPreCutoverSchema(databasePath)) resetPreCutoverSchema(databasePath)
  const database = new DatabaseSync(databasePath)
  migrate(drizzle({ client: database }), { migrationsFolder })
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
