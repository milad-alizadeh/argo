// The saved progress of one query's provider search. Coverage moves only when a search committed.
import { and, eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketSearch } from '@/database/ticket-search/schema'
import { nextUpdatedAt } from '@/database/timestamp-columns'
import type { TicketErrorCode } from '@/domains/tickets/api/messages'

export type TicketSearchTarget = TicketScopeTarget & { query: string }

const touched = nextUpdatedAt(ticketSearch.updatedAt)

export const matchingSearch = ({ provider, scope, query }: TicketSearchTarget) =>
  and(
    eq(ticketSearch.provider, provider),
    eq(ticketSearch.scope, scope),
    eq(ticketSearch.query, query),
  )

export function beginTicketSearch(database: Database, target: TicketSearchTarget): void {
  database
    .insert(ticketSearch)
    .values({ ...target, phase: 'syncing' })
    .onConflictDoUpdate({
      target: [ticketSearch.provider, ticketSearch.scope, ticketSearch.query],
      // The last failure stays until a search completes or fails again, so a retry does not hide it.
      set: { phase: 'syncing', updatedAt: touched },
    })
    .run()
}

export function failTicketSearch(
  database: Database,
  target: TicketSearchTarget,
  failure: TicketErrorCode,
): void {
  database
    .update(ticketSearch)
    .set({ phase: 'failed', failure, updatedAt: touched })
    .where(matchingSearch(target))
    .run()
}

// A search the last process was running when it stopped is no longer running.
export function failInterruptedTicketSearches(database: Database): void {
  database
    .update(ticketSearch)
    .set({ phase: 'failed', failure: 'connection-lost', updatedAt: touched })
    .where(eq(ticketSearch.phase, 'syncing'))
    .run()
}
