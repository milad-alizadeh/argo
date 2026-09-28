import type {
  TicketConnected,
  TicketDiscovered,
  TicketError,
  TicketListed,
  TicketPrioritized,
  TicketUpdated,
} from '@/domains/tickets/contract/contract'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'

export type TicketIndexedReply = RouterOutputs['tickets']['active']
export type TicketIndexed = Extract<TicketIndexedReply, { type: 'ticket.indexed' }>

type TicketSuccess =
  | TicketConnected
  | TicketDiscovered
  | TicketIndexed
  | TicketListed
  | TicketPrioritized
  | TicketUpdated

export function ticketReply<Success extends TicketSuccess>(reply: Success | TicketError): Success
export function ticketReply(reply: TicketSuccess | TicketError): TicketSuccess {
  if (reply.type === 'ticket.error') throw reply
  return reply
}
