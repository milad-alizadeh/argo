// The Backlog's rows: each open Ticket once, a listed child indented under its first listed parent.
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket, TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'

// `nested` is true when a row of the listing is drawn under this one, so this one can fold.
export type BacklogRow = { ticket: Ticket; depth: number; parent: string | null; nested: boolean }

// The Tickets read so far for one query, and how to read the next page of them.
export type Backlog = {
  // The provider the Tickets are read from, which decides how they are drawn.
  provider: Provider
  tickets: readonly Ticket[]
  query: string
  // A search's matches are counted; an unfiltered backlog is counted only once read to its end.
  total: number | null
  hasMore: boolean
  loadingMore: boolean
  // A later page can fail while the pages already read remain useful.
  loadMoreError: string | null
  // A new query is reading while the last one's answer stays on screen.
  searching: boolean
  onLoadMore: () => void
  onRetryLoadMore: () => void
  // Every status a Ticket here can move to, and the move.
  statuses: readonly TicketStatus[]
  onChangeStatus: (key: string, status: TicketStatus) => void
  onChangePriority: (key: string, priority: TicketPriority | null) => void
}

// A Ticket opened while paging shifts the listing, so a Ticket can arrive on two pages.
export function uniqueTickets(pages: readonly { tickets: readonly Ticket[] }[]): Ticket[] {
  const seen = new Set<string>()
  return pages.flatMap((page) =>
    page.tickets.filter((ticket) => !seen.has(ticket.key) && seen.add(ticket.key)),
  )
}

export function backlogRows(tickets: readonly Ticket[]): BacklogRow[] {
  const byKey = new Map(tickets.map((ticket) => [ticket.key, ticket]))
  const nested = new Set(tickets.flatMap((ticket) => ticket.children.map((child) => child.key)))
  const placed = new Set<string>()
  const rows: BacklogRow[] = []
  const place = (ticket: Ticket, depth: number, parent: string | null) => {
    if (placed.has(ticket.key)) return
    placed.add(ticket.key)
    const row = { ticket, depth, parent, nested: false }
    rows.push(row)
    for (const child of ticket.children) {
      const listed = byKey.get(child.key)
      if (listed && !placed.has(listed.key)) row.nested = true
      if (listed) place(listed, depth + 1, ticket.key)
    }
  }
  for (const ticket of tickets) if (!nested.has(ticket.key)) place(ticket, 0, null)
  // A Ticket whose every parent is inside a cycle has no root to hang from, so it becomes one.
  for (const ticket of tickets) place(ticket, 0, null)
  return rows
}

// The rows drawn while some are folded: everything under a folded row stays hidden.
export function unfoldedRows(
  rows: readonly BacklogRow[],
  folded: ReadonlySet<string>,
): BacklogRow[] {
  let hiddenBelow = Number.POSITIVE_INFINITY
  return rows.filter((row) => {
    if (row.depth > hiddenBelow) return false
    hiddenBelow = folded.has(row.ticket.key) ? row.depth : Number.POSITIVE_INFINITY
    return true
  })
}

// For each drawn row, whether the branch in each ancestor column runs on below it. Read from the
// bottom up: a row cuts every column at or deeper than its own depth and opens its parent's.
export function treeRails(rows: readonly BacklogRow[]): boolean[][] {
  const runsOn: boolean[] = []
  const rails = [...rows].reverse().map(({ depth }) => {
    const row = Array.from({ length: depth }, (_, column) => runsOn[column] ?? false)
    runsOn.splice(depth)
    if (depth > 0) runsOn[depth - 1] = true
    return row
  })
  return rails.reverse()
}

// A Ticket is blocked while any Ticket blocking it is still open.
export const openBlockers = (ticket: Ticket): number =>
  ticket.blockedBy?.filter((link) => link.state === 'open').length ?? 0

export const closedChildren = (ticket: Ticket): number =>
  ticket.children.filter((child) => child.state === 'closed').length
