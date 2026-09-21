import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const project = sqliteTable('project', {
  id: text().primaryKey(),
  path: text().notNull(),
  commonDirectory: text('common_directory').notNull().unique(),
})

export const projectSelection = sqliteTable(
  'project_selection',
  {
    singleton: integer().primaryKey(),
    projectId: text('project_id').references(() => project.id),
  },
  (table) => [check('project_selection_singleton', sql`${table.singleton} = 1`)],
)

export const projectSetupCheckpoint = sqliteTable(
  'project_setup_checkpoint',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => project.id),
    worktreePath: text('worktree_path').notNull(),
    phase: text().notNull(),
    configurationSource: text('configuration_source').notNull(),
    documentRevision: text('document_revision').notNull(),
  },
  (table) => [
    check(
      'project_setup_checkpoint_phase',
      sql`${table.phase} IN ('editing', 'validating', 'ready', 'failed', 'cancelled')`,
    ),
  ],
)
