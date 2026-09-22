import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import {
  backupSharedDatabase,
  openSharedDatabase,
  sharedDatabaseBackupPath,
} from '@/platform/main/storage/shared-database'
import { createProjectStore } from './sqlite-store'

export function openProjectStore(projectData: string) {
  const database = openSharedDatabase(projectData)
  const backup = () => {
    void backupSharedDatabase(database, sharedDatabaseBackupPath(projectData)).catch(console.error)
  }
  return createProjectStore(createDurableDatabase(database), backup)
}
