import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { timestampColumns } from '@/database/timestamp-columns'
import type { PlanProgress } from '@/domains/sessions/api/feed-content'
import type { ReportedTurnConfiguration } from '@/domains/sessions/api/reported-turn-configuration'
import { SESSION_STATUSES } from '@/domains/sessions/api/session-live-event'

export const sessionTable = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    harness: text('harness').notNull(),
    nativeId: text('native_id').notNull(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    // The linked worktree the Session runs in; all null when it runs in the Project's main checkout.
    worktreePath: text('worktree_path'),
    worktreeBranch: text('worktree_branch'),
    // True when Argo made the worktree, so archiving the Session can remove it.
    worktreeOwned: integer('worktree_owned', { mode: 'boolean' }),
    customTitle: text('custom_title'),
    preview: text('preview'),
    firstPrompt: text('first_prompt'),
    cwd: text(),
    activityAt: integer('activity_at'),
    // The Session List order: lower first, then newest `createdAt`. Drag and drop will set it.
    sortOrder: integer('sort_order').notNull().default(0),
    // The last activity line, as JSON, so an idle row keeps it with no Feed reader.
    activity: text('activity'),
    // The last status the external Session poll stored; a live channel's own status outranks it.
    status: text('status', { enum: SESSION_STATUSES }).notNull().default('unknown'),
    // The Model, Effort and Mode as the Harness last reported them; null until it reports one.
    turnConfiguration: text('turn_configuration', {
      mode: 'json',
    }).$type<ReportedTurnConfiguration>(),
    // The newest Plan's steps done and in total; null until the Feed holds a Plan.
    planProgress: text('plan_progress', { mode: 'json' }).$type<PlanProgress>(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('session_harness_native').on(table.harness, table.nativeId),
    index('session_list_order').on(table.projectId, table.sortOrder, table.createdAt, table.argoId),
    check(
      'session_worktree',
      sql`(${table.worktreePath} IS NULL) = (${table.worktreeOwned} IS NULL)`,
    ),
  ],
)
