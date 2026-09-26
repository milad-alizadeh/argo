import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'

export const sessionSyncStatus = sqliteTable('session_sync_status', {
  harness: text().primaryKey(),
  phase: text().notNull(),
  processed: integer().notNull(),
  total: integer(),
  skipped: integer().notNull(),
  lastSuccessfulSyncAt: integer('last_successful_sync_at'),
  failure: text(),
  ...timestampColumns(),
})
