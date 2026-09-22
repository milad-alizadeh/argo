import type { TFunction } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { providerPresentation } from '@/domains/accounts/renderer'
import {
  type Backlog,
  backlogRows,
  treeRails,
  unfoldedRows,
} from '@/domains/tickets/renderer/lib/backlog'
import { sourcePresentation } from '@/domains/tickets/renderer/lib/sources'
import { Icon } from '@/platform/renderer/components/icon'
import { Loader } from '@/platform/renderer/components/loader'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { TicketRow } from './ticket-row'

export type TicketListProps = {
  backlog: Backlog
  selectedKey: string | null
  onSelect: (key: string) => void
  // The moment a Ticket's age is measured against, so a caller controls whether it moves.
  now: number
}

function tally(
  t: TFunction<'tickets'>,
  { tickets, query, total, hasMore, searching, provider }: Backlog,
): string {
  if (searching) return t('backlog.searching', { provider: providerPresentation(provider).name })
  if (query !== '') return t('backlog.match', { count: total ?? tickets.length })
  return hasMore
    ? t('backlog.allOpenMore', { count: tickets.length })
    : t('backlog.allOpen', { count: tickets.length })
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
  const { t } = useTranslation('tickets')
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
      {loadingMore ? <Loader aria-label={t('backlog.loadingMore')} className="text-faint" /> : null}
    </li>
  )
}

function NoTickets({ query, provider }: Pick<Backlog, 'query' | 'provider'>) {
  const { t } = useTranslation('tickets')
  const { name, scope } = providerPresentation(provider)
  return (
    <Empty className="flex-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {query === '' ? <Icon name="ticket" /> : <Icon name="no-search-results" />}
        </EmptyMedia>
        <EmptyTitle>
          {query === '' ? t('backlog.empty.title') : t('backlog.empty.titleFiltered')}
        </EmptyTitle>
        <EmptyDescription>
          {query === ''
            ? t('backlog.empty.description', { scope: scope.one })
            : t('backlog.empty.descriptionFiltered', { provider: name, query })}
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

export function TicketList({ backlog, selectedKey, onSelect, now }: TicketListProps) {
  const { t } = useTranslation('tickets')
  const { folded, toggle } = useFolds()
  const rows = unfoldedRows(backlogRows(backlog.tickets), folded)
  const rails = treeRails(rows)
  return (
    <section aria-label={t('backlog.label')} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Empty, as the Session workspace's is: a collapsed sidebar draws its controls over it. */}
      <div className="h-(--size-chrome-bar) shrink-0 border-b border-border/60" />
      <header className="flex shrink-0 items-baseline gap-(--spacing-shell-item) px-(--spacing-shell-inset) pt-(--spacing-shell-inset) pb-(--spacing-shell-item)">
        <h2 className="type-heading">{t('backlog.label')}</h2>
        <p aria-live="polite" className="ml-auto type-meta text-muted-foreground">
          {tally(t, backlog)}
        </p>
      </header>
      {backlog.tickets.length === 0 ? (
        <NoTickets provider={backlog.provider} query={backlog.query} />
      ) : null}
      <ul
        aria-busy={backlog.searching}
        className="grid min-h-0 min-w-0 flex-1 grid-cols-1 content-start gap-px overflow-x-hidden overflow-y-auto px-(--spacing-shell-item) pb-(--spacing-shell-inset) aria-busy:opacity-60"
      >
        {rows.map((row, index) => (
          <li className="min-w-0" key={row.ticket.key}>
            <TicketRow
              rails={rails[index] ?? []}
              folded={folded.has(row.ticket.key)}
              now={now}
              onChangePriority={(priority) => backlog.onChangePriority(row.ticket.key, priority)}
              onChangeStatus={(status) => backlog.onChangeStatus(row.ticket.key, status)}
              onSelect={() => onSelect(row.ticket.key)}
              onToggle={() => toggle(row.ticket.key)}
              presentation={sourcePresentation(backlog.provider)}
              provider={backlog.provider}
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
