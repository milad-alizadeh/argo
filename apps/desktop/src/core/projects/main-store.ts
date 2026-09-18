import { DatabaseSync } from 'node:sqlite'
import { sharedDatabasePath } from '../storage/shared-database'
import { createProjectStore } from './sqlite-store'

export function openProjectStore(projectData: string) {
  return createProjectStore(new DatabaseSync(sharedDatabasePath(projectData)))
}
