// The Backlog's rows: each open Ticket once, a listed child indented under its first listed parent.
import type { Ticket } from '@/core/tickets/contract'

export type BacklogRow = { ticket: Ticket; depth: number; parent: number | null }

export function backlogRows(tickets: readonly Ticket[]): BacklogRow[] {
  const byNumber = new Map(tickets.map((ticket) => [ticket.number, ticket]))
  const nested = new Set(tickets.flatMap((ticket) => ticket.children.map((child) => child.number)))
  const placed = new Set<number>()
  const rows: BacklogRow[] = []
  const place = (ticket: Ticket, depth: number, parent: number | null) => {
    if (placed.has(ticket.number)) return
    placed.add(ticket.number)
    rows.push({ ticket, depth, parent })
    for (const child of ticket.children) {
      const listed = byNumber.get(child.number)
      if (listed) place(listed, depth + 1, ticket.number)
    }
  }
  for (const ticket of tickets) if (!nested.has(ticket.number)) place(ticket, 0, null)
  // A Ticket whose every parent is inside a cycle has no root to hang from, so it becomes one.
  for (const ticket of tickets) place(ticket, 0, null)
  return rows
}

// A Ticket is blocked while any Ticket blocking it is still open.
export const openBlockers = (ticket: Ticket): number =>
  ticket.blockedBy?.filter((link) => link.state === 'open').length ?? 0

export const closedChildren = (ticket: Ticket): number =>
  ticket.children.filter((child) => child.state === 'closed').length

export const count = (total: number, noun: string, plural = `${noun}s`): string =>
  `${total} ${total === 1 ? noun : plural}`
