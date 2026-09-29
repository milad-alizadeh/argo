import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestampColumns } from '@/database/timestamp-columns'
import { PROVIDERS } from '@/domains/accounts/contract/contract'
import { TICKET_ERRORS, type TicketErrorCode } from '@/domains/tickets/api/errors'

export const TICKET_SYNC_KINDS = ['active', 'closed'] as const
// Whether a scan is running; coverage is `complete_scan_started_at`, not the phase.
export const TICKET_SYNC_PHASES = ['idle', 'syncing', 'ready', 'failed'] as const
const TICKET_ERROR_CODES = Object.keys(TICKET_ERRORS) as [TicketErrorCode, ...TicketErrorCode[]]

// One provider scope's scan of one listing. Only a scan that read every page sets its coverage.
export const ticketSync = sqliteTable(
  'ticket_sync',
  {
    provider: text({ enum: PROVIDERS }).notNull(),
    scope: text().notNull(),
    kind: text({ enum: TICKET_SYNC_KINDS }).notNull(),
    phase: text({ enum: TICKET_SYNC_PHASES }).notNull(),
    failure: text({ enum: TICKET_ERROR_CODES }),
    statusesJson: text('statuses_json').notNull().default('[]'),
    scanStartedAt: integer('scan_started_at').notNull(),
    // The start of the latest scan that read every page, and when it finished.
    completeScanStartedAt: integer('complete_scan_started_at'),
    completedAt: integer('completed_at'),
    // A paged listing's place for its next page; null before the first page and after the last.
    nextCursor: text('next_cursor'),
    ...timestampColumns(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.scope, table.kind] })],
)
