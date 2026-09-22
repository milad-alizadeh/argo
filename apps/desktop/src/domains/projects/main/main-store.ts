import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'

export function openProjectStore(projectData: string) {
  const database = openSharedDatabase(projectData)
  return createProjectStore(createDurableDatabase(database))
}
