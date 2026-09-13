import type { Ticket } from '@/core/tickets/contract'
import { backlogRows, closedChildren, count, openBlockers } from '../lib/backlog'

export type TicketListProps = {
  tickets: readonly Ticket[]
  selectedNumber: number | null
  onSelect: (ticketNumber: number) => void
}

// The blocked mark and the children tally each carry their fact in text for a screen reader.
function RowTail({ ticket }: { ticket: Ticket }) {
  const blockers = openBlockers(ticket)
  const children = ticket.children.length
  return (
    <span className="ml-auto flex shrink-0 items-center gap-(--spacing-shell-icon) font-mono type-meta text-faint">
      {blockers > 0 ? (
        <span className="text-danger">
          <span aria-hidden="true">⊘</span>
          <span className="sr-only">Blocked by {count(blockers, 'open Ticket')}</span>
        </span>
      ) : null}
      {children > 0 ? (
        <span>
          <span aria-hidden="true">
            {closedChildren(ticket)}/{children}
          </span>
          <span className="sr-only">
            {closedChildren(ticket)} of {count(children, 'child', 'children')} closed
          </span>
        </span>
      ) : null}
    </span>
  )
}

export function TicketList({ tickets, selectedNumber, onSelect }: TicketListProps) {
  return (
    <section aria-label="Backlog" className="flex min-h-0 flex-col">
      <header className="shrink-0 px-(--spacing-shell-inset) py-(--spacing-shell-gutter)">
        <h2 className="type-heading">Backlog</h2>
        <p className="type-meta text-muted-foreground">
          All open · {count(tickets.length, 'Ticket')}
        </p>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto px-(--spacing-shell-item) pb-(--spacing-shell-gutter)">
        {backlogRows(tickets).map(({ ticket, depth, parent }) => (
          <li key={ticket.number}>
            <button
              aria-current={ticket.number === selectedNumber ? 'true' : undefined}
              className="flex w-full items-center gap-(--spacing-shell-item) rounded-row py-(--spacing-shell-icon) pr-(--spacing-shell-item) text-left type-body hover:bg-muted aria-[current]:bg-muted"
              onClick={() => onSelect(ticket.number)}
              style={{
                paddingInlineStart: `calc(var(--spacing-shell-item) + ${depth} * var(--spacing-shell-inset))`,
              }}
              type="button"
            >
              <span className="shrink-0 font-mono type-meta text-faint">#{ticket.number}</span>
              <span className="min-w-0 truncate">{ticket.title}</span>
              {parent === null ? null : <span className="sr-only">, child of #{parent}</span>}
              <RowTail ticket={ticket} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
