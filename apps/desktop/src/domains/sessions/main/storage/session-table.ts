import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/domains/projects/main/schema'
export const sessionTable = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    harness: text('harness').notNull(),
    nativeId: text('native_id').notNull(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    vendorTitle: text('vendor_title'),
    workingDirectory: text('working_directory'),
    firstPrompt: text('first_prompt'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('session_harness_native').on(table.harness, table.nativeId)],
)

// Reader-owned settings survive a rebuild of the disposable vendor Session index.
export const sessionPreferenceTable = sqliteTable('session_preference', {
  argoId: text('argo_id').primaryKey(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  argoTitle: text('argo_title'),
})
