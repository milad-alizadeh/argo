import { SearchX, Ticket as TicketMark } from 'lucide-react'
import { useEffect, useRef } from 'react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Spinner } from '../../../components/ui/spinner'
import { type Backlog, backlogRows, count } from '../lib/backlog'
import { BacklogFilters } from './BacklogFilters'
import { TicketRow } from './TicketRow'

export type TicketListProps = {
  backlog: Backlog
  selectedNumber: number | null
  onSelect: (ticketNumber: number) => void
}

function tally({ tickets, query, total, hasMore, searching }: Backlog): string {
  if (searching) return 'Searching GitHub…'
  if (query !== '') return count(total ?? tickets.length, 'match', 'matches')
  return hasMore
    ? `All open · ${tickets.length}+ Tickets`
    : `All open · ${count(tickets.length, 'Ticket')}`
}

// Reading the next page starts a screen before the end; keyed by the rows read, it observes
// afresh after each page, so an end still in view reads again.
function NextPage({ backlog }: { backlog: Backlog }) {
  const mark = useRef<HTMLLIElement>(null)
  const load = useRef(backlog.onLoadMore)
  load.current = backlog.onLoadMore
  const { hasMore, loadingMore } = backlog
  useEffect(() => {
    const node = mark.current
    if (!(node && hasMore) || loadingMore) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load.current()
      },
      { root: node.closest('ul'), rootMargin: '0px 0px 100% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore])
  if (!hasMore) return null
  return (
    <li className="flex justify-center py-(--spacing-shell-item)" ref={mark}>
      {loadingMore ? <Spinner aria-label="Reading more Tickets" className="text-faint" /> : null}
    </li>
  )
}

function NoTickets({ query }: { query: string }) {
  return (
    <Empty className="flex-none border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {query === '' ? <TicketMark aria-hidden="true" /> : <SearchX aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>{query === '' ? 'No open Tickets' : 'No open Tickets match'}</EmptyTitle>
        <EmptyDescription>
          {query === ''
            ? 'This repository has no open issues.'
            : `GitHub found nothing for “${query}”.`}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function TicketList({ backlog, selectedNumber, onSelect }: TicketListProps) {
  const now = Date.now()
  return (
    <section aria-label="Backlog" className="flex min-h-0 flex-1 flex-col">
      {/* Empty, as the Session workspace's is: a collapsed sidebar draws its controls over it. */}
      <div className="h-(--size-chrome-bar) shrink-0 border-b border-border/60" />
      <header className="grid shrink-0 gap-(--spacing-shell-item) px-(--spacing-shell-inset) pt-(--spacing-shell-inset) pb-(--spacing-shell-item)">
        <div className="flex items-baseline gap-(--spacing-shell-item)">
          <h2 className="type-heading">Backlog</h2>
          <p aria-live="polite" className="ml-auto type-meta text-muted-foreground">
            {tally(backlog)}
          </p>
        </div>
        <BacklogFilters />
      </header>
      {backlog.tickets.length === 0 ? <NoTickets query={backlog.query} /> : null}
      <ul
        aria-busy={backlog.searching}
        className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto px-(--spacing-shell-item) pb-(--spacing-shell-inset) aria-busy:opacity-60"
      >
        {backlogRows(backlog.tickets).map((row) => (
          <li key={row.ticket.number}>
            <TicketRow
              {...row}
              now={now}
              onSelect={() => onSelect(row.ticket.number)}
              selected={row.ticket.number === selectedNumber}
            />
          </li>
        ))}
        <NextPage backlog={backlog} key={backlog.tickets.length} />
      </ul>
    </section>
  )
}
