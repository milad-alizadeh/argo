// What each provider does for the Ticket core: check a scope, offer the scopes an Account can see,
// read one page of open Tickets and move a Ticket to another status. A new provider is one module
// under `src/providers/` and one line here; nothing in the service branches on which provider it is.

import type {
  Ticket,
  TicketErrorCode,
  TicketPriority,
  TicketScope,
  TicketStatus,
} from '@/domains/tickets/contract/contract'
import type { PriorityChange, StatusChange } from '@/domains/tickets/contract/ticket'
import type { ProviderEndpoints } from '@/providers/endpoints'

// `refused` is the provider refusing the token itself: the one failure an Account renewal can fix.
export type SourceFailure = TicketErrorCode | 'refused'
export type SourceRead<T> = { ok: true; value: T } | { ok: false; failure: SourceFailure }

export type Reader = { endpoints: ProviderEndpoints; token: string }
export type PageRequest = { scope: string; query: string; cursor: string | null }
export type TicketPage = {
  tickets: Ticket[]
  statuses: TicketStatus[]
  nextCursor: string | null
  total: number | null
}

export type TicketSource = {
  check(reader: Reader, scope: string): Promise<SourceRead<TicketScope>>
  discover(reader: Reader): Promise<SourceRead<TicketScope[]>>
  page(reader: Reader, request: PageRequest): Promise<SourceRead<TicketPage>>
  read(
    reader: Reader,
    request: { scope: string; key: string },
  ): Promise<SourceRead<{ ticket: Ticket | null; statuses: TicketStatus[] }>>
  // Moves one Ticket of the scope to one of its statuses, and answers the status it now has.
  update(reader: Reader, change: StatusChange): Promise<SourceRead<TicketStatus>>
  // Moves one Ticket of the scope to another priority level, and answers the priority it now
  // has. A provider that keeps no priority always refuses this.
  updatePriority(reader: Reader, change: PriorityChange): Promise<SourceRead<TicketPriority | null>>
  // What a grant renewal the provider could not answer reads as.
  outage: Record<'rate-limited' | 'unreachable', TicketErrorCode>
}
