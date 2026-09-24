import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
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
