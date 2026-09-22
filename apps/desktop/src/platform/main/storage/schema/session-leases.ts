import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const managedSessionLease = sqliteTable(
  'managed_session_lease',
  {
    harness: text().notNull(),
    nativeId: text('native_id').notNull(),
    windowId: text('window_id').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.harness, table.nativeId] })],
)
