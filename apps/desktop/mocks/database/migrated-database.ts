// An in-memory database built by the real migrations, so test tables match the Drizzle schema.
import { DatabaseSync } from 'node:sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'
import { type Database, databaseFrom, databaseMigrationsFolder } from '@/database/database'
import { project } from '@/database/project/schema'

export function migratedDatabase(): Database {
  const database = databaseFrom(new DatabaseSync(':memory:'))
  migrate(database, { migrationsFolder: databaseMigrationsFolder() })
  return database
}

// Inserts the Project a Session's `project_id` foreign key points at.
export function insertProject(database: Database, id: string, path = `/repo/${id}`) {
  database
    .insert(project)
    .values({ id, path, commonDirectory: `${path}/.git` })
    .onConflictDoNothing()
    .run()
}
