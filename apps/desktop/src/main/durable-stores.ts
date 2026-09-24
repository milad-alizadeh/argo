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

export function openDurableStores(projectData: string, recovery: boolean) {
  const backupPath = sharedDatabaseBackupPath(projectData)
  const databasePath = sharedDatabasePath(projectData)
  return recoverDurableStore({
    databasePath,
    backupPath,
    recovery,
    open: () => {
      const client = openSharedDatabase(projectData)
      const database = createDurableDatabase(client)
      const backup = () => backupSharedDatabase(client, backupPath)
      const projects = createProjectStore(database, () => void backup().catch(console.error))
      const ticketLinks = createSessionTicketLinkStoreFromDatabase(database, () =>
        backup().catch(console.error),
      )
      return { database, databasePath, projects, ticketLinks, close: () => client.close() }
    },
  })
}
