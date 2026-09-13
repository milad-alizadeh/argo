import { SearchX, Ticket as TicketMark } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../../components/ui/empty'
import { Spinner } from '../../../components/ui/spinner'
import { useToastManager } from '../../../components/ui/toast'
import { PROVIDER_PRESENTATION } from '../../accounts/lib/providers'
import { type Backlog, backlogRows, count, treeRails, unfoldedRows } from '../lib/backlog'
import { SOURCE_PRESENTATION } from '../lib/sources'
import { TicketRow } from './TicketRow'

export type TicketListProps = {
  backlog: Backlog
  selectedKey: string | null
  onSelect: (key: string) => void
}

function tally({ tickets, query, total, hasMore, searching, provider }: Backlog): string {
  if (searching) return `Searching ${PROVIDER_PRESENTATION[provider].name}…`
  if (query !== '') return count(total ?? tickets.length, 'match', 'matches')
  return hasMore
    ? `All open · ${tickets.length}+ Tickets`
    : `All open · ${count(tickets.length, 'Ticket')}`
}

// A page the provider failed to send is a passing fault: a toast offers the retry, the rows read stay.
function useLoadMoreFailure({ loadMoreError, loadingMore, onRetryLoadMore }: Backlog) {
  // The manager object changes with every toast; its add and close do not.
  const { add, close } = useToastManager()
  const retry = useRef(onRetryLoadMore)
  retry.current = onRetryLoadMore
  useEffect(() => {
    if (!loadMoreError || loadingMore) return
    const id = add({
      title: loadMoreError,
      type: 'error',
      priority: 'high',
      timeout: 0,
      actionProps: { children: 'Try again', onClick: () => retry.current() },
    })
    return () => close(id)
  }, [add, close, loadMoreError, loadingMore])
}

// Reading the next page starts a screen before the end; keyed by the rows read, it observes
// afresh after each page, so an end still in view reads again.
function NextPage({ backlog }: { backlog: Backlog }) {
  const mark = useRef<HTMLLIElement>(null)
  const load = useRef(backlog.onLoadMore)
  load.current = backlog.onLoadMore
  const { hasMore, loadingMore, loadMoreError } = backlog
  useLoadMoreFailure(backlog)
  useEffect(() => {
    const node = mark.current
    if (!(node && hasMore) || loadingMore || loadMoreError) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) load.current()
      },
      { root: node.closest('ul'), rootMargin: '0px 0px 100% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loadMoreError])
  if (!hasMore) return null
  return (
    <li className="flex justify-center py-(--spacing-shell-item)" ref={mark}>
      {loadingMore ? <Spinner aria-label="Reading more Tickets" className="text-faint" /> : null}
    </li>
  )
}

function NoTickets({ query, provider }: Pick<Backlog, 'query' | 'provider'>) {
  const { name, scope } = PROVIDER_PRESENTATION[provider]
  return (
    <Empty className="flex-none border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {query === '' ? <TicketMark aria-hidden="true" /> : <SearchX aria-hidden="true" />}
        </EmptyMedia>
        <EmptyTitle>{query === '' ? 'No open Tickets' : 'No open Tickets match'}</EmptyTitle>
        <EmptyDescription>
          {query === ''
            ? `This ${scope.one} has no open Tickets.`
            : `${name} found nothing for “${query}”.`}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// A folded parent hides the rows under it until it is unfolded; every parent starts unfolded.
function useFolds() {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const toggle = (key: string) =>
    setFolded((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  return { folded, toggle }
}

export function TicketList({ backlog, selectedKey, onSelect }: TicketListProps) {
  const now = Date.now()
  const { folded, toggle } = useFolds()
  const rows = unfoldedRows(backlogRows(backlog.tickets), folded)
  const rails = treeRails(rows)
  return (
    <section aria-label="Backlog" className="flex min-h-0 flex-1 flex-col">
      {/* Empty, as the Session workspace's is: a collapsed sidebar draws its controls over it. */}
      <div className="h-(--size-chrome-bar) shrink-0 border-b border-border/60" />
      <header className="flex shrink-0 items-baseline gap-(--spacing-shell-item) px-(--spacing-shell-inset) pt-(--spacing-shell-inset) pb-(--spacing-shell-item)">
        <h2 className="type-heading">Backlog</h2>
        <p aria-live="polite" className="ml-auto type-meta text-muted-foreground">
          {tally(backlog)}
        </p>
      </header>
      {backlog.tickets.length === 0 ? (
        <NoTickets provider={backlog.provider} query={backlog.query} />
      ) : null}
      <ul
        aria-busy={backlog.searching}
        className="grid min-h-0 flex-1 content-start gap-px overflow-y-auto px-(--spacing-shell-item) pb-(--spacing-shell-inset) aria-busy:opacity-60"
      >
        {rows.map((row, index) => (
          <li key={row.ticket.key}>
            <TicketRow
              rails={rails[index] ?? []}
              folded={folded.has(row.ticket.key)}
              now={now}
              onChangeStatus={(status) => backlog.onChangeStatus(row.ticket.key, status)}
              onSelect={() => onSelect(row.ticket.key)}
              onToggle={() => toggle(row.ticket.key)}
              presentation={SOURCE_PRESENTATION[backlog.provider]}
              row={row}
              selected={row.ticket.key === selectedKey}
              statuses={backlog.statuses}
            />
          </li>
        ))}
        <NextPage backlog={backlog} key={backlog.tickets.length} />
      </ul>
    </section>
  )
}
