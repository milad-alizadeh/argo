import { sql } from 'drizzle-orm'
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { project } from './projects'

export const workspaceKinds = ['main', 'imported', 'managed'] as const

export const workspace = sqliteTable(
  'workspace',
  {
    id: text().primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    kind: text({ enum: workspaceKinds }).notNull(),
    displayName: text('display_name').notNull(),
    path: text().notNull(),
    baseRef: text('base_ref').notNull(),
  },
  (table) => [
    check('workspace_kind', sql`${table.kind} IN ('main', 'imported', 'managed')`),
    check('workspace_display_name', sql`length(${table.displayName}) > 0`),
  ],
)

export const projectWorkspaceSelection = sqliteTable('project_workspace_selection', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => project.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
})

export const managedWorkspaceRecovery = sqliteTable('managed_workspace_recovery', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  checkoutRemovedAt: text('checkout_removed_at').notNull(),
})
