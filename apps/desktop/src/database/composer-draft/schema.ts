import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { timestampColumns } from '@/database/timestamp-columns'
import { workspace } from '@/database/workspace/schema'

export const composerDraft = sqliteTable(
  'composer_draft',
  {
    id: text().primaryKey(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => sessionTable.argoId, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspace.id, { onDelete: 'cascade' }),
    harness: text({ enum: ['claude', 'codex'] }),
    prompt: text().notNull().default(''),
    attachmentsJson: text('attachments_json').notNull().default('[]'),
    ticketContextJson: text('ticket_context_json').notNull().default('[]'),
    model: text().notNull(),
    effort: text().notNull(),
    mode: text().notNull(),
    revision: integer().notNull().default(0),
    ...timestampColumns(),
  },
  (table) => [
    check(
      'composer_draft_target',
      sql`(${table.projectId} IS NOT NULL) != (${table.sessionId} IS NOT NULL)`,
    ),
    check(
      'composer_draft_new_session_fields',
      sql`(${table.projectId} IS NULL AND ${table.workspaceId} IS NULL AND ${table.harness} IS NULL) OR (${table.projectId} IS NOT NULL AND ${table.workspaceId} IS NOT NULL AND ${table.harness} IS NOT NULL)`,
    ),
    check('composer_draft_revision', sql`${table.revision} >= 0`),
  ],
)
