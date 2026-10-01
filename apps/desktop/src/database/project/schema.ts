import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'

export const project = sqliteTable('project', {
  id: text().primaryKey(),
  path: text().notNull(),
  commonDirectory: text('common_directory').notNull().unique(),
  // The new-Session folder last chosen: 'new', 'main', or an existing worktree's path.
  lastWorktreeChoice: text('last_worktree_choice').notNull().default('new'),
  ...timestampColumns(),
})
