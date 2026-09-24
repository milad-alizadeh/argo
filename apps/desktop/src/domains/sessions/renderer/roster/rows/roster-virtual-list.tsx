import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import type { SessionId } from '../../types'
import { moveFocus } from './roster-arrow-keys'
import { RosterContextMenu } from './roster-context-menu'
import { RosterRowView } from './roster-row-view'
import { ROSTER_ROW_HEIGHT, type RosterRow, type RosterRowHandlers, rowPlace } from './roster-rows'
import { useSentinelFetch } from './use-roster-sentinel-fetch'

// Overscan generous enough to keep a roster's realistic session count fully mounted, so arrow-key
// navigation (which walks the mounted buttons) behaves the same as the flat list it replaces;
// windowing still kicks in for a roster large enough to exceed it.
const OVERSCAN = 30

export function RosterVirtualList({
  label,
  onArchive,
  onFetchMoreSessions,
  onFetchNextPage,
  onFetchNextSearchPage,
  onFocus,
  onOpenTicket,
  onRename,
  onSelect,
  onToggleSelect,
  renamedTitles,
  rows,
  selectedIds,
  selectedSessionId,
  tabStop,
  unavailableSessionIds,
}: RosterRowHandlers & {
  label: string
  onFetchNextPage: () => void
  onFetchNextSearchPage: () => void
  renamedTitles: Record<string, string>
  rows: readonly RosterRow[]
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
  unavailableSessionIds: ReadonlySet<SessionId>
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROSTER_ROW_HEIGHT,
    overscan: OVERSCAN,
  })
  const items = virtualizer.getVirtualItems()
  // Read after the items: computing them is what settles the visible range.
  const range = virtualizer.range
  useSentinelFetch({ rows, kind: 'rosterSentinel', range, onFetch: onFetchMoreSessions })
  useSentinelFetch({ rows, kind: 'archivedSentinel', range, onFetch: onFetchNextPage })
  useSentinelFetch({ rows, kind: 'searchSentinel', range, onFetch: onFetchNextSearchPage })

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
      data-slot="roster-scroll"
      ref={scrollRef}
    >
      <RosterContextMenu
        onArchive={onArchive}
        onOpenTicket={onOpenTicket}
        onRename={onRename}
        renamedTitles={renamedTitles}
        rows={rows}
      >
        <nav aria-label={label} className="min-w-0">
          <ul
            className="relative flex min-w-0 flex-col px-3"
            onKeyDown={moveFocus}
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
                    <RosterRowView
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
      </RosterContextMenu>
    </div>
  )
}
