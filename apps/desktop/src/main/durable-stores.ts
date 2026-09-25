import { createDurableDatabase } from '@/database/durable-database'
import { recoverDurableStore } from '@/database/durable-store-recovery'
import {
  backupSharedDatabase,
  openSharedDatabase,
  sharedDatabaseBackupPath,
  sharedDatabasePath,
} from '@/database/shared-database'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { createSessionTicketLinkStoreFromDatabase } from '@/domains/tickets/main/session-links'

export function openDurableStores(projectData: string, recovery: boolean) {
  const backupPath = sharedDatabaseBackupPath(projectData)
  return recoverDurableStore({
    databasePath: sharedDatabasePath(projectData),
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
      return { database, projects, ticketLinks, close: () => client.close() }
    },
  })
}
