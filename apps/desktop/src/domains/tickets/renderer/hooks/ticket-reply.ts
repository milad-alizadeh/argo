import type {
  TicketConnected,
  TicketDiscovered,
  TicketError,
  TicketListed,
  TicketPrioritized,
  TicketUpdated,
} from '@/domains/tickets/contract/contract'

type TicketSuccess =
  | TicketConnected
  | TicketDiscovered
  | TicketListed
  | TicketPrioritized
  | TicketUpdated

export function ticketReply<Success extends TicketSuccess>(reply: Success | TicketError): Success
export function ticketReply(reply: TicketSuccess | TicketError): TicketSuccess {
  if (reply.type === 'ticket.error') throw reply
  return reply
}
