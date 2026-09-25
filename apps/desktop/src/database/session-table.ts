import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project-tables'
import { timestampColumns } from '@/database/timestamp-columns'
export const sessionTable = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    harness: text('harness').notNull(),
    nativeId: text('native_id').notNull(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    customTitle: text('custom_title'),
    preview: text('preview'),
    firstPrompt: text('first_prompt'),
    cwd: text(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex('session_harness_native').on(table.harness, table.nativeId)],
)
