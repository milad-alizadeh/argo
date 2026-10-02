import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sessionTable } from '@/database/session/schema'

export const SESSION_SUBAGENT_STATES = [
  'unknown',
  'running',
  'completed',
  'failed',
  'interrupted',
] as const

// Discovery can know a Subagent's identity before its history establishes a state.
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
  (table) => [
    primaryKey({ columns: [table.sessionId, table.subagentId] }),
    // The Session List looks a Session up by its native ID here to leave children out.
    index('session_subagent_subagent').on(table.subagentId),
  ],
)
