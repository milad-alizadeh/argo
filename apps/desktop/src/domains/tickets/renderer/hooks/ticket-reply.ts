import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type TicketIndexedReply = RouterOutputs['ticketActive']
export type TicketIndexed = Extract<TicketIndexedReply, { type: 'ticket.indexed' }>
export type TicketSearchedReply = RouterOutputs['ticketSearch']
export type TicketSearched = Extract<TicketSearchedReply, { type: 'ticket.searched' }>
type TicketSearchRequested = Extract<
  RouterOutputs['ticketSearchProvider'],
  { type: 'ticket.search-requested' }
>

export type TicketError = Extract<RouterOutputs[keyof RouterOutputs], { type: 'ticket.error' }>
export type TicketConnectedReply = RouterOutputs['ticketConnection']
type TicketConnected = Extract<TicketConnectedReply, { type: 'ticket.connected' }>
export type ConnectionSummary = NonNullable<TicketConnected['connection']>
export type TicketDiscoverReply = RouterOutputs['ticketDiscover']
type TicketDiscovered = Extract<TicketDiscoverReply, { type: 'ticket.discovered' }>
export type TicketScope = TicketDiscovered['scopes'][number]
export type TicketUpdated = Extract<RouterOutputs['ticketUpdateStatus'], { type: 'ticket.updated' }>
export type TicketPrioritized = Extract<
  RouterOutputs['ticketUpdatePriority'],
  { type: 'ticket.prioritized' }
>
export type TicketPriorityChoices = Extract<
  RouterOutputs['ticketPriorityChoices'],
  { type: 'ticket.priorityChoices' }
>

type TicketSuccess =
  | TicketConnected
  | TicketDiscovered
  | TicketIndexed
  | TicketSearched
  | TicketSearchRequested
  | TicketPriorityChoices
  | TicketPrioritized
  | TicketUpdated

export function ticketReply<Success extends TicketSuccess>(reply: Success | TicketError): Success
export function ticketReply(reply: TicketSuccess | TicketError): TicketSuccess {
  if (reply.type === 'ticket.error') throw reply
  return reply
}
