import type { Ticket } from '@/domains/tickets/contract/contract'

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
