import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'

export const project = sqliteTable('project', {
  id: text().primaryKey(),
  path: text().notNull(),
  commonDirectory: text('common_directory').notNull().unique(),
  // The composer's Worktree switch as last set: on gives a new Session its own new worktree.
  newWorktree: integer('new_worktree', { mode: 'boolean' }).notNull().default(false),
  ...timestampColumns(),
})
