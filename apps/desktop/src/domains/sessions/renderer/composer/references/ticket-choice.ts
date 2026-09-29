import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket } from '@/domains/tickets/api/ticket'
import type { TicketChoice } from './context-picker/context-picker-contents'

export function ticketChoice(provider: Provider, ticket: Ticket): TicketChoice {
  return {
    provider,
    key: ticket.key,
    title: ticket.title,
    status: ticket.status.name,
    terminal: ticket.state === 'closed',
    blocked:
      ticket.blockedBy === null ? null : ticket.blockedBy.some((link) => link.state === 'open'),
  }
}
