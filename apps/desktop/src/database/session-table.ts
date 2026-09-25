import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project-tables'
export const sessionTable = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    harness: text('harness').notNull(),
    nativeId: text('native_id').notNull(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    customTitle: text('custom_title'),
    vendorPreview: text('vendor_preview'),
    firstPrompt: text('first_prompt'),
    cwd: text(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('session_harness_native').on(table.harness, table.nativeId)],
)
