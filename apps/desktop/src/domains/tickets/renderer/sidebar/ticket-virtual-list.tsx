import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/virtual-core'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader } from '@/platform/renderer/components/loader/loader'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { type Backlog, type BacklogRow, treeRails } from '../lib/backlog'
import { sourcePresentation } from '../lib/sources'
import { TicketRow } from './ticket-row'

const OVERSCAN = 30
const WORKSPACE_ROW_ESTIMATE = 52
const SIDEBAR_ROW_ESTIMATE = 88

type TicketVirtualListProps = {
  backlog: Backlog
  folded: ReadonlySet<string>
  now: number
  onSelect: (key: string) => void
  onToggle: (key: string) => void
  placement: 'workspace' | 'sidebar'
  rows: readonly BacklogRow[]
  selectedKey: string | null
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

// The range excludes overscan. Reading the sentinel therefore means the reader reached it, rather
// than merely mounting it early to keep scrolling smooth.
function useNextPage({
  backlog,
  range,
  rowCount,
}: {
  backlog: Backlog
  range: { startIndex: number; endIndex: number } | null
  rowCount: number
}) {
  const load = useRef(backlog.onLoadMore)
  load.current = backlog.onLoadMore
  const reached = backlog.hasMore && range?.endIndex === rowCount
  useEffect(() => {
    if (reached && !backlog.loadingMore && !backlog.loadMoreError) load.current()
  }, [backlog.loadMoreError, backlog.loadingMore, reached])
}

function NextPage({ loading }: { loading: boolean }) {
  const { t } = useTranslation('tickets')
  return (
    <div className="flex justify-center py-(--spacing-shell-item)">
      {loading ? <Loader aria-label={t('backlog.loadingMore')} className="text-faint" /> : null}
    </div>
  )
}

function VirtualTicketRow({
  backlog,
  folded,
  item,
  measureElement,
  now,
  onSelect,
  onToggle,
  placement,
  rails,
  row,
  selectedKey,
}: Omit<TicketVirtualListProps, 'rows'> & {
  item: VirtualItem
  measureElement: (node: Element | null) => void
  rails: readonly boolean[]
  row: BacklogRow | undefined
}) {
  return (
    <li
      className="absolute inset-x-0 top-0 min-w-0 pb-px"
      data-index={item.index}
      ref={measureElement}
      style={{ transform: `translateY(${item.start}px)` }}
    >
      {row ? (
        <TicketRow
          folded={folded.has(row.ticket.key)}
          now={now}
          onChangePriority={(priority) => backlog.onChangePriority(row.ticket.key, priority)}
          onChangeStatus={(status) => backlog.onChangeStatus(row.ticket.key, status)}
          onSelect={() => onSelect(row.ticket.key)}
          onToggle={() => onToggle(row.ticket.key)}
          placement={placement}
          presentation={sourcePresentation(backlog.provider)}
          provider={backlog.provider}
          rails={rails}
          row={row}
          selected={row.ticket.key === selectedKey}
          statuses={backlog.statuses}
        />
      ) : (
        <NextPage loading={backlog.loadingMore} />
      )}
    </li>
  )
}

// Each currently visible Ticket tree row is a virtual item. Measured rows preserve multiline titles
// and expanded label rails; keying by Ticket prevents stale measurements after a parent folds.
export function TicketVirtualList({
  backlog,
  folded,
  now,
  onSelect,
  onToggle,
  placement,
  rows,
  selectedKey,
}: TicketVirtualListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const count = rows.length + Number(backlog.hasMore)
  const virtualizer = useVirtualizer({
    count,
    getItemKey: (index) => rows[index]?.ticket.key ?? 'next-page',
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (placement === 'workspace' ? WORKSPACE_ROW_ESTIMATE : SIDEBAR_ROW_ESTIMATE),
    overscan: OVERSCAN,
  })
  const items = virtualizer.getVirtualItems()
  const range = virtualizer.range
  const rails = treeRails(rows)
  useLoadMoreFailure(backlog)
  useNextPage({ backlog, range, rowCount: rows.length })

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-[calc(var(--inset-cockpit-content-body,var(--spacing-shell-inset))-var(--spacing-shell-item))] pb-(--spacing-shell-inset)"
      data-slot="ticket-list-scroll"
      ref={scrollRef}
    >
      <ul
        aria-busy={backlog.searching}
        className="relative min-w-0 aria-busy:opacity-60"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {items.map((item) => {
          const row = rows[item.index]
          return (
            <VirtualTicketRow
              backlog={backlog}
              folded={folded}
              key={item.key}
              item={item}
              measureElement={virtualizer.measureElement}
              now={now}
              onSelect={onSelect}
              onToggle={onToggle}
              placement={placement}
              rails={rails[item.index] ?? []}
              row={row}
              selectedKey={selectedKey}
            />
          )
        })}
      </ul>
    </div>
  )
}
