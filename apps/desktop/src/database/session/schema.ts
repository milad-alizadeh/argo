import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { timestampColumns } from '@/database/timestamp-columns'
import { workspace } from '@/database/workspace/schema'

export const sessionTable = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    harness: text('harness').notNull(),
    nativeId: text('native_id').notNull(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'set null' }),
    customTitle: text('custom_title'),
    preview: text('preview'),
    firstPrompt: text('first_prompt'),
    cwd: text(),
    activityAt: integer('activity_at'),
    // The Session List order: lower first, then newest `createdAt`. Drag and drop will set it.
    sortOrder: integer('sort_order').notNull().default(0),
    // The last activity line a Feed read, as JSON, so an idle row keeps it with no Feed reader.
    activity: text('activity'),
    // The last status the history watcher saw; a live channel's own status outranks it.
    status: text('status'),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('session_harness_native').on(table.harness, table.nativeId),
    index('session_list_order').on(table.projectId, table.sortOrder, table.createdAt, table.argoId),
  ],
)
