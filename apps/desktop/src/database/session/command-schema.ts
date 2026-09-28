import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { sessionTable } from './schema'

export const sessionCommandTable = sqliteTable(
  'session_command',
  {
    commandId: text('command_id').primaryKey(),
    intentId: text('intent_id'),
    sessionId: text('session_id').references(() => sessionTable.argoId, { onDelete: 'set null' }),
    harness: text('harness'),
    nativeId: text('native_id'),
    turnId: text('turn_id'),
    cwd: text('cwd'),
    status: text('status', {
      enum: ['queued', 'accepted', 'running', 'completed', 'uncertain'],
    }).notNull(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex('session_command_intent').on(table.intentId)],
)
