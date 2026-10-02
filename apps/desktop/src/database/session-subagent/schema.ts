import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sessionTable } from '@/database/session/schema'

export const SESSION_SUBAGENT_STATES = [
  'unknown',
  'running',
  'completed',
  'failed',
  'interrupted',
] as const

// One row per Subagent of a Harness; the parent is null until a saved Session is known to own it.
export const sessionSubagent = sqliteTable(
  'session_subagent',
  {
    harness: text().notNull(),
    nativeId: text('native_id').notNull(),
    parentSessionId: text('parent_session_id').references(() => sessionTable.argoId, {
      onDelete: 'cascade',
    }),
    label: text(),
    state: text({ enum: SESSION_SUBAGENT_STATES }).notNull(),
  },
  (table) => [
    // The Session List looks a Session up by Harness and native ID here to leave children out.
    primaryKey({ columns: [table.harness, table.nativeId] }),
    index('session_subagent_parent').on(table.parentSessionId),
  ],
)
