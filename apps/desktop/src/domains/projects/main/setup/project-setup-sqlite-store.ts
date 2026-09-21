import type { ProjectDatabase } from '@/domains/projects/main/sqlite-store'
import { projectSetupStorage } from './project-setup-store'

export function projectSetupStore(database: ProjectDatabase, afterWrite: () => void) {
  const storage = projectSetupStorage(database)
  return {
    readProjectSetup: (projectId: string) => storage.read(projectId),
    writeProjectSetup: (record: Parameters<typeof storage.write>[0]) => {
      storage.write(record)
      afterWrite()
    },
  }
}
