import type { Ticket } from '@/domains/tickets/contract/contract'
import { openBlockers } from '../lib/backlog'

export type WorkPathTicket = Pick<Ticket, 'key' | 'title'>

export type TicketWorkPath = {
  start: WorkPathTicket
  unlocks: readonly WorkPathTicket[]
  readyOutsidePath: WorkPathTicket | null
}

// A work path is evidence from provider relationships, not an AI claim: start with the listed
// Ticket whose completion releases the most listed work, then keep one independent option nearby.
export function ticketWorkPath(tickets: readonly Ticket[]): TicketWorkPath | null {
  const open = tickets.filter((ticket) => ticket.state === 'open')
  const candidates = open
    .filter((start) => openBlockers(start) === 0)
    .map((start) => ({
      start,
      unlocks: open.filter((ticket) =>
        ticket.blockedBy?.some((blocker) => blocker.state === 'open' && blocker.key === start.key),
      ),
    }))
    .filter(({ unlocks }) => unlocks.length > 0)
    .sort((left, right) => right.unlocks.length - left.unlocks.length)
  const strongest = candidates[0]
  if (!strongest) return null

  const path = new Set([strongest.start.key, ...strongest.unlocks.map((ticket) => ticket.key)])
  const readyOutsidePath =
    open.find((ticket) => !path.has(ticket.key) && openBlockers(ticket) === 0) ?? null
  return {
    start: strongest.start,
    unlocks: strongest.unlocks,
    readyOutsidePath,
  }
}
