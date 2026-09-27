import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sessionTable } from './schema'

export const sessionLiveCursor = sqliteTable('session_live_cursor', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => sessionTable.argoId, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
})

export const sessionLiveEvent = sqliteTable(
  'session_live_event',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessionTable.argoId, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    payload: text('payload').notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.sequence] })],
)
