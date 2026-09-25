import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { project } from '@/database/project/schema'
import { timestampColumns } from '@/database/timestamp-columns'
import { workspace } from '@/database/workspace/schema'

export const projectWorkspaceSelection = sqliteTable('project_workspace_selection', {
  projectId: text('project_id')
    .primaryKey()
    .references(() => project.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspace.id, { onDelete: 'cascade' }),
  ...timestampColumns(),
})
