import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { workspace } from '@/database/workspace/schema'

export const managedWorkspaceRecovery = sqliteTable('managed_workspace_recovery', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  checkoutRemovedAt: text('checkout_removed_at').notNull(),
  ...timestampColumns(),
})
