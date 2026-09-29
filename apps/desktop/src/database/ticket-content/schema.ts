import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { ticketTable } from '@/database/ticket/schema'
import { timestampColumns } from '@/database/timestamp-columns'

// The provider's latest facts for one Ticket, replaced whole by each provider read.
export const ticketContent = sqliteTable(
  'ticket_content',
  {
    ticketId: text('ticket_id')
      .primaryKey()
      .references(() => ticketTable.argoId, { onDelete: 'cascade' }),
    key: text().notNull(),
    url: text(),
    title: text().notNull(),
    body: text(),
    state: text({ enum: ['open', 'closed'] }).notNull(),
    statusJson: text('status_json').notNull(),
    priorityJson: text('priority_json'),
    providerCreatedAt: text('provider_created_at').notNull(),
    labelsJson: text('labels_json').notNull(),
    type: text(),
    childrenJson: text('children_json').notNull(),
    blockedByJson: text('blocked_by_json'),
    // The provider's order within the active scan that last listed this Ticket.
    position: integer(),
    // The start of the active scan that last listed this Ticket.
    listedAt: integer('listed_at'),
    ...timestampColumns(),
  },
  (table) => [index('ticket_content_listed').on(table.listedAt, table.position)],
)
