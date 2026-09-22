import { existsSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { sharedDatabaseBackupPath, sharedDatabasePath } from '../storage/shared-database-path'

export function resetIncompleteDevelopmentDatabase(projectData: string): boolean {
  const databasePath = sharedDatabasePath(projectData)
  if (!existsSync(databasePath)) return false

  let database: DatabaseSync | undefined
  try {
    database = new DatabaseSync(databasePath, { readOnly: true })
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('__drizzle_migrations', 'project')",
      )
      .all() as { name: string }[]
    const { count } = database
      .prepare('SELECT count(*) AS count FROM __drizzle_migrations')
      .get() as { count: number }
    if (tables.length !== 2 || count !== 0) return false
  } catch {
    return false
  } finally {
    database?.close()
  }

  rmSync(databasePath)
  rmSync(sharedDatabaseBackupPath(projectData), { force: true })
  return true
}
