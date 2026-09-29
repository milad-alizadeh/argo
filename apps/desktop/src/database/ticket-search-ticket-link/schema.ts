import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ticketTable } from '@/database/ticket/schema'

// A Ticket the provider returned for a search, in the provider's order.
export const ticketSearchTicketLink = sqliteTable(
  'ticket_search_ticket_link',
  {
    provider: text().notNull(),
    scope: text().notNull(),
    query: text().notNull(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => ticketTable.argoId, { onDelete: 'cascade' }),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.scope, table.query, table.ticketId] }),
    index('ticket_search_ticket_link_ticket').on(table.ticketId),
  ],
)
