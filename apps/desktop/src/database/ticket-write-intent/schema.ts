import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { TICKET_ERRORS, type TicketErrorCode } from '@/domains/tickets/contract/contract'
import { ticketTable } from '../ticket/schema'

export const TICKET_WRITE_OPERATIONS = ['status', 'priority'] as const
// `pending` is recorded before the provider call; it claims no change to the Ticket.
export const TICKET_WRITE_PHASES = ['pending', 'committed', 'rejected', 'uncertain'] as const
const TICKET_ERROR_CODES = Object.keys(TICKET_ERRORS) as [TicketErrorCode, ...TicketErrorCode[]]

// One provider write Argo means to make, kept until the provider's answer is committed or refused.
export const ticketWriteIntent = sqliteTable('ticket_write_intent', {
  intentId: text('intent_id').primaryKey(),
  ticketId: text('ticket_id')
    .notNull()
    .references(() => ticketTable.argoId, { onDelete: 'cascade' }),
  operation: text({ enum: TICKET_WRITE_OPERATIONS }).notNull(),
  // The requested value, such as the provider status ID.
  requestedJson: text('requested_json').notNull(),
  // The saved facts' `updated_at` when the intent was recorded.
  baseUpdatedAt: integer('base_updated_at').notNull(),
  phase: text({ enum: TICKET_WRITE_PHASES }).notNull(),
  failure: text({ enum: TICKET_ERROR_CODES }),
  ...timestampColumns(),
})
