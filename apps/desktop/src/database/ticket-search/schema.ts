import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { PROVIDERS } from '@/domains/accounts/contract/contract'
import { TICKET_ERRORS, type TicketErrorCode } from '@/domains/tickets/api/messages'

export const TICKET_SEARCH_PHASES = ['syncing', 'ready', 'failed'] as const
const TICKET_ERROR_CODES = Object.keys(TICKET_ERRORS) as [TicketErrorCode, ...TicketErrorCode[]]

// One provider search of a scope. Coverage is `completed_at`: the last search that committed.
export const ticketSearch = sqliteTable(
  'ticket_search',
  {
    provider: text({ enum: PROVIDERS }).notNull(),
    scope: text().notNull(),
    query: text().notNull(),
    phase: text({ enum: TICKET_SEARCH_PHASES }).notNull(),
    failure: text({ enum: TICKET_ERROR_CODES }),
    completedAt: integer('completed_at'),
    ...timestampColumns(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.scope, table.query] })],
)
