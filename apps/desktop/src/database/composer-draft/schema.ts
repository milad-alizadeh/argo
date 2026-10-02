import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { timestampColumns } from '@/database/timestamp-columns'
import { HARNESSES } from '@/harnesses/harness'

export const composerDraft = sqliteTable(
  'composer_draft',
  {
    id: text().primaryKey(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').references(() => sessionTable.argoId, { onDelete: 'cascade' }),
    // A new-Session draft's folder: the main checkout, or a new worktree. A new worktree starts
    // from a local branch, or from the main checkout's commit without one.
    worktree: text({ enum: ['main', 'new'] }),
    worktreeFromBranch: text('worktree_from_branch'),
    harness: text({ enum: HARNESSES }),
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
    uniqueIndex('composer_draft_project').on(table.projectId),
    uniqueIndex('composer_draft_session').on(table.sessionId),
    check(
      'composer_draft_target',
      sql`(${table.projectId} IS NOT NULL) != (${table.sessionId} IS NOT NULL)`,
    ),
    check(
      'composer_draft_new_session_fields',
      sql`(${table.projectId} IS NULL AND ${table.worktree} IS NULL AND ${table.harness} IS NULL) OR (${table.projectId} IS NOT NULL AND ${table.worktree} IS NOT NULL AND ${table.harness} IS NOT NULL)`,
    ),
    check('composer_draft_worktree', sql`${table.worktree} IN ('main', 'new')`),
    check(
      'composer_draft_worktree_from',
      sql`${table.worktreeFromBranch} IS NULL OR ${table.worktree} = 'new'`,
    ),
    check(
      'composer_draft_worktree_from_branch',
      sql`${table.worktreeFromBranch} IS NULL OR (length(${table.worktreeFromBranch}) > 0 AND substr(${table.worktreeFromBranch}, 1, 1) != '-')`,
    ),
    check('composer_draft_revision', sql`${table.revision} >= 0`),
  ],
)
