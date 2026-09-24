import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { createSessionTicketLinkStoreFromDatabase } from '@/domains/tickets/main/session-links'
import { createDurableDatabase } from '@/platform/main/storage/durable-database'
import { recoverDurableStore } from '@/platform/main/storage/durable-store-recovery'
import {
  backupSharedDatabase,
  openSharedDatabase,
  sharedDatabaseBackupPath,
  sharedDatabasePath,
} from '@/platform/main/storage/shared-database'

export function openDurableStores(
  projectData: string,
  recovery: boolean,
  developmentInstanceId: string | null = null,
) {
  const backupPath = sharedDatabaseBackupPath(projectData)
  return recoverDurableStore({
    databasePath: sharedDatabasePath(projectData),
    backupPath,
    recovery,
    open: () => {
      const client = openSharedDatabase(projectData)
      const database = createDurableDatabase(client)
      const backup = () => backupSharedDatabase(client, backupPath)
      const projects = createProjectStore(
        database,
        () => void backup().catch(console.error),
        developmentInstanceId,
      )
      const ticketLinks = createSessionTicketLinkStoreFromDatabase(database, () =>
        backup().catch(console.error),
      )
      return { database, projects, ticketLinks, close: () => client.close() }
    },
  })
}
