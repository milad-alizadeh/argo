import { createDurableDatabase } from '@/database/durable-database'
import { openSharedDatabase } from '@/database/shared-database'
import { createProjectStore } from './sqlite-store'

export function openProjectStore(projectData: string) {
  const database = openSharedDatabase(projectData)
  return createProjectStore(createDurableDatabase(database))
}
