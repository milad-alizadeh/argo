import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const session = sqliteTable(
  'session',
  {
    argoId: text('argo_id').primaryKey(),
    harness: text().notNull(),
    nativeId: text('native_id').notNull(),
    title: text(),
    firstPrompt: text('first_prompt'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('session_harness_native').on(table.harness, table.nativeId)],
)

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
