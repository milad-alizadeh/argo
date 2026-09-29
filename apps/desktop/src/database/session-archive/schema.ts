import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sessionTable } from '@/database/session/schema'

// Argo's own archive flag. A Session stays in the vendor history and leaves the active roster.
export const sessionArchive = sqliteTable('session_archive', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => sessionTable.argoId, { onDelete: 'cascade' }),
})
