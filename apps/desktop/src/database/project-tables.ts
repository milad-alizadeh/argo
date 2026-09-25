import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'

export const project = sqliteTable('project', {
  id: text().primaryKey(),
  path: text().notNull(),
  commonDirectory: text('common_directory').notNull().unique(),
  ...timestampColumns(),
})

export const projectSelection = sqliteTable(
  'project_selection',
  {
    singleton: integer().primaryKey(),
    projectId: text('project_id').references(() => project.id),
    ...timestampColumns(),
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
    ...timestampColumns(),
  },
  (table) => [
    check(
      'project_setup_checkpoint_phase',
      sql`${table.phase} IN ('editing', 'validating', 'ready', 'failed', 'cancelled')`,
    ),
  ],
)

export const projectSetupActor = sqliteTable(
  'project_setup_actor',
  {
    projectId: text('project_id')
      .primaryKey()
      .references(() => project.id),
    checkpointVersion: integer('checkpoint_version').notNull(),
    machineVersion: integer('machine_version').notNull(),
    revision: integer().notNull(),
    persistedSnapshot: text('persisted_snapshot').notNull(),
    receipts: text().notNull(),
    savedAt: text('saved_at').notNull(),
    ...timestampColumns(),
  },
  (table) => [
    check('project_setup_actor_checkpoint_version', sql`${table.checkpointVersion} = 1`),
    check('project_setup_actor_machine_version', sql`${table.machineVersion} > 0`),
    check('project_setup_actor_revision', sql`${table.revision} >= 0`),
  ],
)

export const projectSetupEffect = sqliteTable('project_setup_effect', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => project.id),
  intentJson: text('intent_json').notNull(),
  resultJson: text('result_json').notNull(),
  savedAt: text('saved_at').notNull(),
  ...timestampColumns(),
})

export const projectSetupRecovery = sqliteTable('project_setup_recovery', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => project.id),
  rawRecord: text('raw_record').notNull(),
  reason: text().notNull(),
  savedAt: text('saved_at').notNull(),
  ...timestampColumns(),
})

export const workspaceKinds = ['main', 'imported', 'managed'] as const

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
    baseRef: text('base_ref').notNull(),
    ...timestampColumns(),
  },
  (table) => [
    check('workspace_kind', sql`${table.kind} IN ('main', 'imported', 'managed')`),
    check('workspace_display_name', sql`length(${table.displayName}) > 0`),
  ],
)

export const projectWorkspaceSelection = sqliteTable('project_workspace_selection', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => project.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  ...timestampColumns(),
})

export const managedWorkspaceRecovery = sqliteTable('managed_workspace_recovery', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  checkoutRemovedAt: text('checkout_removed_at').notNull(),
  ...timestampColumns(),
})
