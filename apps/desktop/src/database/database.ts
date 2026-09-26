import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/node-sqlite'

type DatabaseSync = import('node:sqlite').DatabaseSync
type OpenDatabaseOptions = {
  packaged?: boolean
  migrationsFolder?: string
}

const BUSY_TIMEOUT_MS = 5000
const SESSION_SEARCH_MIGRATION = '20260925212921_session_search'
const resourcesPath = (process as NodeJS.Process & { resourcesPath: string }).resourcesPath

export const databaseFrom = (client: DatabaseSync) => drizzle({ client })

export type Database = Omit<ReturnType<typeof databaseFrom>, '$client'> & {
  $client: DatabaseSync
}

export function databasePath(userData: string): string {
  return path.join(userData, 'argo.sqlite')
}

export function databaseMigrationsFolder(packaged = false): string {
  return packaged
    ? path.join(resourcesPath, 'app.asar', 'drizzle')
    : path.resolve(process.cwd(), 'drizzle')
}

function runtimeRequire(packaged: boolean) {
  return createRequire(
    packaged
      ? path.join(resourcesPath, 'app.asar', 'package.json')
      : path.join(process.cwd(), 'package.json'),
  )
}

export function openDatabase(userData: string, options: OpenDatabaseOptions = {}): Database {
  const packaged = options.packaged ?? false
  const require = runtimeRequire(packaged)
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
  const { migrate } =
    require('drizzle-orm/node-sqlite/migrator') as typeof import('drizzle-orm/node-sqlite/migrator')
  mkdirSync(userData, { recursive: true })
  const client = new DatabaseSync(databasePath(userData))
  client.exec('PRAGMA journal_mode = WAL')
  client.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`)
  const database = databaseFrom(client)
  migrate(database, {
    migrationsFolder: options.migrationsFolder ?? databaseMigrationsFolder(packaged),
  })
  return database
}

export function rebuildDatabaseIndexes(
  database: Database,
  migrationsFolder = databaseMigrationsFolder(),
): void {
  database.$client.exec('DROP TABLE session_search')
  database.$client.exec(
    readFileSync(path.join(migrationsFolder, SESSION_SEARCH_MIGRATION, 'migration.sql'), 'utf8'),
  )
}
