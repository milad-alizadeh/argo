import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// A Subagent discovery found with no parent to link it under: out of the Session List, never re-read.
export const parentlessSubagent = sqliteTable(
  'parentless_subagent',
  {
    harness: text().notNull(),
    nativeId: text('native_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.harness, table.nativeId] })],
)
