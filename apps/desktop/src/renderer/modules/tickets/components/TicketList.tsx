import { Ban, ListTree } from 'lucide-react'

import './ticket-tokens.css'

import type { Ticket } from '@/core/tickets/contract'
import { Item } from '../../../components/ui/item'
import { backlogRows, closedChildren, count, openBlockers } from '../lib/backlog'

export type TicketListProps = {
  tickets: readonly Ticket[]
  selectedNumber: number | null
  onSelect: (ticketNumber: number) => void
}

const markIcon = 'size-(--size-icon-meta) shrink-0'

// The blocked mark and the children tally each carry their fact in text for a screen reader.
function RowTail({ ticket }: { ticket: Ticket }) {
  const blockers = openBlockers(ticket)
  const children = ticket.children.length
  if (blockers === 0 && children === 0) return null
  return (
    <span className="ml-auto flex shrink-0 items-center gap-(--spacing-shell-item) type-meta text-muted-foreground">
      {blockers > 0 ? (
        <span className="flex items-center gap-(--spacing-shell-tight) text-danger">
          <Ban aria-hidden="true" className={markIcon} />
          <span className="sr-only">Blocked by {count(blockers, 'open Ticket')}</span>
        </span>
      ) : null}
      {children > 0 ? (
        <span className="flex items-center gap-(--spacing-shell-tight) tabular-nums">
          <ListTree aria-hidden="true" className={markIcon} />
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

// The number column is one width, so every title starts on one line and a child indents from it.
export function TicketList({ tickets, selectedNumber, onSelect }: TicketListProps) {
  return (
    <section aria-label="Backlog" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-baseline gap-(--spacing-shell-item) px-(--spacing-shell-inset) pt-(--spacing-shell-inset) pb-(--spacing-shell-item)">
        <h2 className="type-heading">Backlog</h2>
        <p className="ml-auto type-meta text-muted-foreground">
          All open · {count(tickets.length, 'Ticket')}
        </p>
      </header>
      <ul className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto px-(--spacing-shell-item) pb-(--spacing-shell-inset)">
        {backlogRows(tickets).map(({ ticket, depth, parent }) => (
          <li key={ticket.number}>
            <Item
              aria-current={ticket.number === selectedNumber ? 'true' : undefined}
              className="flex-nowrap gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left hover:bg-muted aria-[current]:bg-muted"
              onClick={() => onSelect(ticket.number)}
              render={<button type="button" />}
              size="xs"
            >
              <span className="w-(--size-ticket-number) shrink-0 font-mono type-meta text-faint">
                #{ticket.number}
              </span>
              <span
                className="min-w-0 truncate type-body"
                style={{ paddingInlineStart: `calc(${depth} * var(--spacing-shell-inset))` }}
              >
                {ticket.title}
              </span>
              {parent === null ? null : <span className="sr-only">, child of #{parent}</span>}
              <RowTail ticket={ticket} />
            </Item>
          </li>
        ))}
      </ul>
    </section>
  )
}
