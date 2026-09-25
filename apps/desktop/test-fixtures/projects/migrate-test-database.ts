import type { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { databaseMigrationsFolder } from '@/database/migrations-folder'

export function migrateTestDatabase(database: Database, migrationsFolder: string): void {
  migrate(drizzle({ client: database }), { migrationsFolder })
}

export const projectMigrationsFolder = (): string => databaseMigrationsFolder()
