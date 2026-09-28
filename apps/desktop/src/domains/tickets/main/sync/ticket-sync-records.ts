// The saved progress of one provider scope's scan. Coverage moves only when every page was read.
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { type TICKET_SYNC_KINDS, ticketSync } from '@/database/ticket-sync/schema'
import type { TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'
import type { TicketScopeTarget } from '../database/ticket-upsert'

export type TicketSyncTarget = TicketScopeTarget & { kind: (typeof TICKET_SYNC_KINDS)[number] }

const touched = sql`MAX(CAST(unixepoch('subsec') * 1000 AS INTEGER), ${ticketSync.updatedAt} + 1)`

const matching = ({ provider, scope, kind }: TicketSyncTarget) =>
  and(eq(ticketSync.provider, provider), eq(ticketSync.scope, scope), eq(ticketSync.kind, kind))

export function beginTicketScan(
  database: Database,
  target: TicketSyncTarget,
  scanStartedAt: number,
): void {
  database
    .insert(ticketSync)
    .values({ ...target, phase: 'syncing', scanStartedAt })
    .onConflictDoUpdate({
      target: [ticketSync.provider, ticketSync.scope, ticketSync.kind],
      set: { phase: 'syncing', failure: null, scanStartedAt, updatedAt: touched },
    })
    .run()
}

export function completeTicketScan(
  database: Database,
  target: TicketSyncTarget,
  { statuses, completedAt }: { statuses: readonly TicketStatus[]; completedAt: number },
): void {
  database
    .update(ticketSync)
    .set({
      phase: 'ready',
      failure: null,
      statusesJson: JSON.stringify(statuses),
      completeScanStartedAt: sql`${ticketSync.scanStartedAt}`,
      completedAt,
      updatedAt: touched,
    })
    .where(matching(target))
    .run()
}

export function failTicketScan(
  database: Database,
  target: TicketSyncTarget,
  failure: TicketErrorCode,
): void {
  database
    .update(ticketSync)
    .set({ phase: 'failed', failure, updatedAt: touched })
    .where(matching(target))
    .run()
}

// A scan the last process was running when it stopped is no longer running.
export function markInterruptedTicketScans(database: Database): void {
  database
    .update(ticketSync)
    .set({ phase: 'idle', updatedAt: touched })
    .where(eq(ticketSync.phase, 'syncing'))
    .run()
}
