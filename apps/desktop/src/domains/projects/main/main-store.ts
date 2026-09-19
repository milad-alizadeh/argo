import { DatabaseSync } from 'node:sqlite'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { sharedDatabasePath } from '@/platform/main/storage/shared-database'

export function openProjectStore(projectData: string) {
  return createProjectStore(new DatabaseSync(sharedDatabasePath(projectData)))
}
