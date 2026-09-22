import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sessionTicketLink = sqliteTable(
  'session_ticket_link',
  {
    sessionId: text('session_id').primaryKey(),
    projectId: text('project_id').notNull(),
    ticketKey: text('ticket_key').notNull(),
    title: text().notNull(),
    state: text().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('session_ticket_link_ticket').on(table.projectId, table.ticketKey, table.createdAt),
  ],
)
