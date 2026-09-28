import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sessionTable } from '@/database/session/schema'

export const SESSION_SUBAGENT_STATES = ['running', 'completed', 'failed', 'interrupted'] as const

// The Subagents a Session's history names, as the last sync read them.
export const sessionSubagent = sqliteTable(
  'session_subagent',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessionTable.argoId, { onDelete: 'cascade' }),
    subagentId: text('subagent_id').notNull(),
    label: text(),
    state: text({ enum: SESSION_SUBAGENT_STATES }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.subagentId] })],
)
