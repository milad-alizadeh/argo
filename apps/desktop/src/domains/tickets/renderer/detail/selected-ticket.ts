import type { Ticket } from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

export type TicketSelectionState =
  | { kind: 'none' }
  | { kind: 'ready'; ticket: Ticket }
  | { kind: 'loading' }
  | { kind: 'failure'; error: ContractFailure }
  | { kind: 'missing' }

export function ticketForSelection(
  tickets: readonly Ticket[],
  selectedKey: string | null,
  resolvedTicket: Ticket | null,
): Ticket | null {
  if (selectedKey === null) return null
  return (
    tickets.find((ticket) => ticket.key === selectedKey) ??
    (resolvedTicket?.key === selectedKey ? resolvedTicket : null)
  )
}

export function ticketSelectionState(options: {
  tickets: readonly Ticket[]
  selectedKey: string | null
  resolvedTicket: Ticket | null
  pending: boolean
  error: ContractFailure | null
}): TicketSelectionState {
  const { tickets, selectedKey, resolvedTicket, pending, error } = options
  if (selectedKey === null) return { kind: 'none' }
  const ticket = ticketForSelection(tickets, selectedKey, resolvedTicket)
  if (ticket !== null) return { kind: 'ready', ticket }
  if (error !== null) return { kind: 'failure', error }
  if (pending) return { kind: 'loading' }
  return { kind: 'missing' }
}
