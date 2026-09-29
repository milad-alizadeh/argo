// The saved progress of one provider scope's scan. Coverage moves only when every page was read.
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { type TICKET_SYNC_KINDS, ticketSync } from '@/database/ticket-sync/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { TicketErrorCode, TicketStatus } from '@/domains/tickets/contract/contract'

export type TicketSyncTarget = TicketScopeTarget & { kind: (typeof TICKET_SYNC_KINDS)[number] }

const touched = nextUpdatedAt(ticketSync.updatedAt)

export const matchingScan = ({ provider, scope, kind }: TicketSyncTarget) =>
  and(eq(ticketSync.provider, provider), eq(ticketSync.scope, scope), eq(ticketSync.kind, kind))

// The listing mark for a new scan; it passes the last one even when the clock repeats or goes back.
export function beginTicketScan(database: Database, target: TicketSyncTarget, now: number): number {
  const row = database
    .insert(ticketSync)
    .values({ ...target, phase: 'syncing', scanStartedAt: now })
    .onConflictDoUpdate({
      target: [ticketSync.provider, ticketSync.scope, ticketSync.kind],
      // The last failure stays until a scan completes or fails again, so a retry does not hide it.
      set: {
        phase: 'syncing',
        scanStartedAt: sql`MAX(${now}, ${ticketSync.scanStartedAt} + 1)`,
        updatedAt: touched,
      },
    })
    .returning({ scanStartedAt: ticketSync.scanStartedAt })
    .get()
  if (row === undefined) throw new Error('The Ticket scan did not persist.')
  return row.scanStartedAt
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
    .where(matchingScan(target))
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
    .where(matchingScan(target))
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
