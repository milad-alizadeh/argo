import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'

export const sessionCommandTable = sqliteTable(
  'session_command',
  {
    commandId: text('command_id').primaryKey(),
    intentId: text('intent_id').notNull(),
    sessionId: text('session_id'),
    harness: text('harness').notNull(),
    nativeId: text('native_id'),
    turnId: text('turn_id'),
    cwd: text('cwd').notNull(),
    outcome: text('outcome').notNull(),
    ...timestampColumns(),
  },
  (table) => [uniqueIndex('session_command_intent').on(table.intentId)],
)
