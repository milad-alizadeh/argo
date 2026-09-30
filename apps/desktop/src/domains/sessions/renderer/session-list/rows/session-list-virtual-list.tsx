import { useVirtualizer } from '@tanstack/react-virtual'
import { type RefObject, useRef } from 'react'
import type { SessionId } from '../../types'
import {
  rowPlace,
  SESSION_LIST_ROW_HEIGHT,
  type SessionListRow,
  type SessionListRowHandlers,
  sessionListRowKey,
} from './session-list-rows'
import { SessionRowContextMenu } from './session-row-context-menu'
import { SessionRowView } from './session-row-view'
import { useActiveRange, useListFocus, useScrollAnchor } from './use-session-list-scrolling'
import { useSentinelFetch } from './use-session-list-sentinel-fetch'

// Rows mounted beyond the visible range on each side; keyboard focus moves by list position.
const OVERSCAN = 10

function useRowVirtualizer(
  rows: readonly SessionListRow[],
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  return useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => {
      const row = rows[index]
      return row === undefined ? index : sessionListRowKey(row)
    },
    estimateSize: () => SESSION_LIST_ROW_HEIGHT,
    overscan: OVERSCAN,
  })
}

export function SessionListVirtualList({
  label,
  onArchive,
  onFetchNextPage,
  onFocus,
  onOpenTicket,
  onRename,
  onSelect,
  onShowRange,
  onToggleSelect,
  renamedTitles,
  rows,
  selectedIds,
  selectedSessionId,
  tabStop,
  unavailableSessionIds,
}: SessionListRowHandlers & {
  label: string
  onFetchNextPage: () => void
  onShowRange: (start: number, end: number) => void
  renamedTitles: Record<string, string>
  rows: readonly SessionListRow[]
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
  unavailableSessionIds: ReadonlySet<SessionId>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useRowVirtualizer(rows, scrollRef)
  const items = virtualizer.getVirtualItems()
  // Read after the items: computing them is what settles the visible range.
  const range = virtualizer.range
  useSentinelFetch({ rows, kind: 'archivedSentinel', range, onFetch: onFetchNextPage })
  useActiveRange(rows, range, onShowRange)
  useScrollAnchor(virtualizer, rows)
  const onKeyDown = useListFocus(virtualizer, rows, scrollRef)

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
      data-slot="session-list-scroll"
      ref={scrollRef}
    >
      <SessionRowContextMenu
        onArchive={onArchive}
        onOpenTicket={onOpenTicket}
        onRename={onRename}
        renamedTitles={renamedTitles}
        rows={rows}
      >
        <nav aria-label={label} className="min-w-0">
          <ul
            className="relative flex min-w-0 flex-col px-3"
            onKeyDown={onKeyDown}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {items.map((item) => {
              const row = rows[item.index]
              return (
                <li
                  className="absolute inset-x-3 top-0 pb-1"
                  data-index={item.index}
                  key={item.key}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {row === undefined ? null : (
                    <SessionRowView
                      onFocus={onFocus}
                      onSelect={onSelect}
                      onToggleSelect={onToggleSelect}
                      renamedTitles={renamedTitles}
                      row={row}
                      unavailable={
                        row.kind === 'session' && unavailableSessionIds.has(row.session.id)
                      }
                      {...rowPlace(row, { selectedIds, selectedSessionId, tabStop })}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      </SessionRowContextMenu>
    </div>
  )
}
