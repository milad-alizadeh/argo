import { Ban, ListTree } from 'lucide-react'

import type { Ticket } from '@/core/tickets/contract'
import { ticketAge } from '@/core/tickets/ticket-age'
import { Badge } from '../../../components/ui/badge'
import { Item } from '../../../components/ui/item'
import { type BacklogRow, closedChildren, count, openBlockers } from '../lib/backlog'

const markIcon = 'size-(--size-icon-meta) shrink-0'
// Past this many, the rest of a row's labels are counted rather than drawn.
const SHOWN_LABELS = 2

// The blocked mark and the children tally each carry their fact in text for a screen reader.
function Marks({ ticket }: { ticket: Ticket }) {
  const blockers = openBlockers(ticket)
  const children = ticket.children.length
  if (blockers === 0 && children === 0) return null
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-item) type-meta text-muted-foreground">
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

function Labels({ labels }: { labels: Ticket['labels'] }) {
  if (labels.length === 0) return null
  const hidden = labels.length - SHOWN_LABELS
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-tight)">
      {labels.slice(0, SHOWN_LABELS).map((label) => (
        <Badge className="text-muted-foreground" key={label.name} variant="outline">
          {label.name}
        </Badge>
      ))}
      {hidden > 0 ? (
        <span className="type-meta text-faint">
          <span aria-hidden="true">+{hidden}</span>
          <span className="sr-only">and {count(hidden, 'more label')}</span>
        </span>
      ) : null}
    </span>
  )
}

type TicketRowProps = BacklogRow & { selected: boolean; now: number; onSelect: () => void }

// The number column is one width, so every title starts on one line and a child indents from it.
export function TicketRow({ ticket, depth, parent, selected, now, onSelect }: TicketRowProps) {
  const age = ticketAge(ticket.createdAt, now)
  return (
    <Item
      aria-current={selected ? 'true' : undefined}
      className="flex-nowrap gap-(--spacing-shell-item) rounded-row px-(--spacing-shell-item) py-(--spacing-shell-icon) text-left hover:bg-muted aria-[current]:bg-muted"
      onClick={onSelect}
      render={<button type="button" />}
      size="xs"
    >
      <span className="w-(--size-ticket-number) shrink-0 font-mono type-meta text-faint">
        #{ticket.number}
      </span>
      <span
        className="min-w-0 flex-1 truncate type-body"
        style={{ paddingInlineStart: `calc(${depth} * var(--spacing-shell-inset))` }}
      >
        {ticket.title}
      </span>
      <Labels labels={ticket.labels} />
      <Marks ticket={ticket} />
      <time
        className="w-(--size-ticket-age) shrink-0 text-right type-meta text-faint tabular-nums"
        dateTime={ticket.createdAt}
      >
        <span aria-hidden="true">{age.short}</span>
        <span className="sr-only">{age.long}</span>
      </time>
      {parent === null ? null : <span className="sr-only">, child of #{parent}</span>}
    </Item>
  )
}
