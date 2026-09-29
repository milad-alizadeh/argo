import type {
  TicketConnected,
  TicketDiscovered,
  TicketError,
  TicketPrioritized,
  TicketPriorityChoices,
  TicketUpdated,
} from '@/domains/tickets/api/messages'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type TicketIndexedReply = RouterOutputs['ticketActive']
export type TicketIndexed = Extract<TicketIndexedReply, { type: 'ticket.indexed' }>
export type TicketSearchedReply = RouterOutputs['ticketSearch']
export type TicketSearched = Extract<TicketSearchedReply, { type: 'ticket.searched' }>
export type TicketSearchRequested = Extract<
  RouterOutputs['ticketSearchProvider'],
  { type: 'ticket.search-requested' }
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
