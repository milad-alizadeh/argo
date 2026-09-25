import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { timestampColumns } from '@/database/timestamp-columns'

export const projectSelection = sqliteTable(
  'project_selection',
  {
    singleton: integer().primaryKey(),
    projectId: text('project_id').references(() => project.id),
    ...timestampColumns(),
  },
  (table) => [check('project_selection_singleton', sql`${table.singleton} = 1`)],
)
