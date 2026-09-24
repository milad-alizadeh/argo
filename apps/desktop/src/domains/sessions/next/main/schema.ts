import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/domains/projects/main/schema'

export const session = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    harness: text().notNull(),
    nativeId: text('native_id').notNull(),
    title: text(),
    firstPrompt: text('first_prompt'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('session_harness_native').on(table.harness, table.nativeId)],
)

export const managedSessionLease = sqliteTable(
  'managed_session_lease',
  {
    harness: text().notNull(),
    nativeId: text('native_id').notNull(),
    windowId: text('window_id').notNull(),
    ownerToken: text('owner_token').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.harness, table.nativeId] })],
)

export const sessionLaunchIntent = sqliteTable('session_launch_intent', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull(),
  harness: text().notNull(),
  prompt: text().notNull(),
  createdAt: integer('created_at').notNull(),
  nativeId: text('native_id'),
  status: text({ enum: ['starting', 'uncertain', 'committed', 'rejected'] }).notNull(),
})
