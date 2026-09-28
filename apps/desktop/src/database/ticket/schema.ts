import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { PROVIDERS } from '@/domains/accounts/contract/contract'

// A Ticket's durable Argo identity. The provider scope, not a Connection, defines the Ticket.
export const ticketTable = sqliteTable(
  'ticket',
  {
    argoId: text('argo_id').primaryKey(),
    provider: text({ enum: PROVIDERS }).notNull(),
    scope: text().notNull(),
    nativeId: text('native_id').notNull(),
    ...timestampColumns(),
  },
  (table) => [
    uniqueIndex('ticket_provider_scope_native').on(table.provider, table.scope, table.nativeId),
  ],
)
