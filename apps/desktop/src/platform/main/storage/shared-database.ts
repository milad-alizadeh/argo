import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

type DatabaseSync = import('node:sqlite').DatabaseSync

const nodeRequire = createRequire(import.meta.url)

const MIGRATIONS_TABLE = '__drizzle_migrations'
const LEGACY_TABLES = [
  'project',
  'project_selection',
  'project_setup_checkpoint',
  'session_ticket_link',
]
const SESSION_SEARCH_MIGRATION = '20260921153755_session_search'

function sqliteRuntime() {
  return nodeRequire('node:sqlite') as typeof import('node:sqlite')
}

function migrateDatabase(database: DatabaseSync, migrationsFolder: string): void {
  const { drizzle } = nodeRequire(
    'drizzle-orm/node-sqlite',
  ) as typeof import('drizzle-orm/node-sqlite')
  const { migrate } = nodeRequire(
    'drizzle-orm/node-sqlite/migrator',
  ) as typeof import('drizzle-orm/node-sqlite/migrator')
  migrate(drizzle({ client: database }), { migrationsFolder })
}

function packagedMigrationsFolder(): string {
  return path.resolve(import.meta.dirname, '..', '..', 'drizzle')
}

function hasPreCutoverSchema(databasePath: string): boolean {
  if (!existsSync(databasePath)) return false
  const { DatabaseSync } = sqliteRuntime()
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
  const { DatabaseSync } = sqliteRuntime()
  const database = new DatabaseSync(databasePath)
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
