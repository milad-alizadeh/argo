// An in-memory database built by the real migrations, so test tables match the Drizzle schema.
import { DatabaseSync } from 'node:sqlite'
import { migrate } from 'drizzle-orm/node-sqlite/migrator'
import { type Database, databaseFrom, databaseMigrationsFolder } from '@/database/database'
import { project } from '@/database/project/schema'
import { workspace } from '@/database/workspace/schema'

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

// Inserts the Workspace, and its Project, a Session's `workspace_id` foreign key points at.
export function insertWorkspace(database: Database, id: string, projectId: string) {
  insertProject(database, projectId)
  database
    .insert(workspace)
    .values({ id, projectId, kind: 'managed', displayName: id, path: `/repo/${projectId}/${id}` })
    .onConflictDoNothing()
    .run()
}
