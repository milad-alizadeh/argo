import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { createProjectStore } from './sqlite-store'

export function openProjectStore(projectData: string) {
  const database = openSharedDatabase(projectData)
  return createProjectStore(createDurableDatabase(database))
}
