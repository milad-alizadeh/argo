import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { sessionTable } from './schema'

export const sessionCommandTable = sqliteTable('session_command', {
  commandId: text('command_id').primaryKey(),
  sessionId: text('session_id').references(() => sessionTable.argoId, { onDelete: 'set null' }),
  status: text('status', {
    enum: ['queued', 'accepted', 'running', 'completed', 'uncertain'],
  }).notNull(),
  ...timestampColumns(),
})
