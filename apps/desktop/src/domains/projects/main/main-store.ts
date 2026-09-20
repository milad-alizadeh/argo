import { DatabaseSync } from 'node:sqlite'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import {
  backupSharedDatabase,
  sharedDatabaseBackupPath,
  sharedDatabasePath,
} from '@/platform/main/storage/shared-database'

export function openProjectStore(projectData: string) {
  const database = new DatabaseSync(sharedDatabasePath(projectData))
  const backup = () => {
    void backupSharedDatabase(database, sharedDatabaseBackupPath(projectData)).catch(console.error)
  }
  return createProjectStore(database, backup)
}
