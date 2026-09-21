import type { Database } from 'bun:sqlite'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

export function migrateTestDatabase(database: Database, migrationsFolder: string): void {
  migrate(drizzle({ client: database }), { migrationsFolder })
}

export const projectMigrationsFolder = (directory: string): string =>
  path.resolve(directory, '../../../../../../drizzle')
