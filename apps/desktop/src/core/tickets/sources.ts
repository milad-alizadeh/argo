// What each provider does for the Ticket core: check a scope, offer the scopes an Account can see,
// and read one page of open Tickets. A new provider is one module under `src/providers/` and one
// line here; nothing in the service branches on which provider it is.
import type { ProviderEndpoints } from '../../providers/endpoints'
import { githubTickets } from '../../providers/github/ticket-source'
import { linearTickets } from '../../providers/linear/ticket-source'
import type { Provider } from '../accounts/contract'
import type { Ticket, TicketErrorCode, TicketScope } from './contract'

// `refused` is the provider refusing the token itself: the one failure an Account renewal can fix.
export type SourceFailure = TicketErrorCode | 'refused'
export type SourceRead<T> = { ok: true; value: T } | { ok: false; failure: SourceFailure }

export type Reader = { endpoints: ProviderEndpoints; token: string }
export type PageRequest = { scope: string; query: string; cursor: string | null }
export type TicketPage = { tickets: Ticket[]; nextCursor: string | null; total: number | null }

export type TicketSource = {
  check(reader: Reader, scope: string): Promise<SourceRead<TicketScope>>
  discover(reader: Reader): Promise<SourceRead<TicketScope[]>>
  page(reader: Reader, request: PageRequest): Promise<SourceRead<TicketPage>>
  // What a grant renewal the provider could not answer reads as.
  outage: Record<'rate-limited' | 'unreachable', TicketErrorCode>
}

export const TICKET_SOURCES: Record<Provider, TicketSource> = {
  github: githubTickets,
  linear: linearTickets,
}
