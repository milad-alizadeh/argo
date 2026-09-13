import { Ban, ChevronRight } from 'lucide-react'

import type { Ticket, TicketStatus } from '@/core/tickets/contract'
import { ticketAge } from '@/core/tickets/ticket-age'
import { type BacklogRow, closedChildren, count, openBlockers } from '../lib/backlog'
import type { SourcePresentation } from '../lib/sources'
import { ChildProgress } from './ChildProgress'
import { StatusMenu } from './StatusMenu'
import { TicketLabel } from './TicketLabel'

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
          <ChildProgress closed={closedChildren(ticket)} total={children} />
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
        <TicketLabel key={label.name} label={label} />
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

// A parent's chevron folds the rows drawn under it. A row with none keeps the chevron's width, so
// every title at one depth starts on one line.
function Fold({ row, folded, onToggle }: Pick<TicketRowProps, 'row' | 'folded' | 'onToggle'>) {
  if (!row.nested) return <span aria-hidden="true" className="w-(--size-icon-control) shrink-0" />
  const { key } = row.ticket
  return (
    <button
      aria-expanded={!folded}
      aria-label={`${folded ? 'Expand' : 'Collapse'} ${key}`}
      className="relative z-10 flex w-(--size-icon-control) shrink-0 items-center justify-center self-stretch rounded-row text-faint hover:text-foreground"
      onClick={onToggle}
      type="button"
    >
      <ChevronRight
        aria-hidden="true"
        className={`${markIcon} transition-transform ${folded ? '' : 'rotate-90'}`}
      />
    </button>
  )
}

type TicketRowProps = {
  row: BacklogRow
  presentation: Pick<SourcePresentation, 'keyColumn' | 'statusNoun'>
  statuses: readonly TicketStatus[]
  selected: boolean
  folded: boolean
  now: number
  onSelect: () => void
  onToggle: () => void
  onChangeStatus: (status: TicketStatus) => void
}

// The row selects wherever it is pressed but on its status and its chevron: the select button's
// overlay covers the row, and those two sit above it. The overlay draws the button's ring, so the
// keyboard cursor outlines the whole row. The key column is one width, so every title
// starts on one line and a child indents from it.
export function TicketRow(props: TicketRowProps) {
  const { row, presentation, statuses, selected, folded, now, onSelect, onToggle, onChangeStatus } =
    props
  const { ticket, depth, parent } = row
  const age = ticketAge(ticket.createdAt, now)
  return (
    <div className="relative flex items-center gap-(--spacing-shell-tight) rounded-row px-(--spacing-shell-item) hover:bg-muted has-[[aria-current]]:bg-muted">
      <span
        aria-hidden="true"
        className={`${presentation.keyColumn} shrink-0 font-mono type-meta text-faint`}
      >
        {ticket.key}
      </span>
      <StatusMenu
        named={false}
        noun={presentation.statusNoun}
        onChange={onChangeStatus}
        status={ticket.status}
        statuses={statuses}
      />
      <span
        className="flex shrink-0 self-stretch"
        style={{ paddingInlineStart: `calc(${depth} * var(--spacing-shell-inset))` }}
      >
        <Fold folded={folded} onToggle={onToggle} row={row} />
      </span>
      <button
        aria-current={selected ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-(--spacing-shell-item) py-(--spacing-shell-icon) text-left outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-ring focus-visible:after:-outline-offset-2"
        onClick={onSelect}
        type="button"
      >
        <span className="sr-only">{ticket.key} </span>
        <span className="min-w-0 flex-1 truncate type-body">{ticket.title}</span>
        <Labels labels={ticket.labels} />
        <Marks ticket={ticket} />
        <time
          className="w-(--size-ticket-age) shrink-0 text-right type-meta text-faint tabular-nums"
          dateTime={ticket.createdAt}
        >
          <span aria-hidden="true">{age.short}</span>
          <span className="sr-only">{age.long}</span>
        </time>
        {parent === null ? null : <span className="sr-only">, child of {parent}</span>}
      </button>
    </div>
  )
}
