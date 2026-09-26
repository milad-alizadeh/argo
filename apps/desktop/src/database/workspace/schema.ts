import { sql } from 'drizzle-orm'
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { timestampColumns } from '@/database/timestamp-columns'

export const workspaceKinds = ['main', 'imported'] as const

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
    ...timestampColumns(),
  },
  (table) => [
    check('workspace_kind', sql`${table.kind} IN ('main', 'imported')`),
    check('workspace_display_name', sql`length(${table.displayName}) > 0`),
  ],
)
