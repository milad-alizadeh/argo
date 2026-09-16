import { useVirtualizer } from '@tanstack/react-virtual'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import type { SessionId } from '../../types'
import { RosterContextMenu } from './roster-context-menu'
import { RosterRowView } from './roster-row-view'
import { ROSTER_ROW_HEIGHT, type RosterRow, type RosterRowHandlers } from './roster-rows'

function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const buttons = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-session-id]'),
  ]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current === -1) return
  event.preventDefault()
  const nextByKey = {
    ArrowDown: Math.min(current + 1, buttons.length - 1),
    ArrowUp: Math.max(current - 1, 0),
    End: buttons.length - 1,
    Home: 0,
  }
  buttons[nextByKey[event.key as keyof typeof nextByKey]]?.focus()
}

// Overscan generous enough to keep a roster's realistic session count fully mounted, so arrow-key
// navigation (which walks the mounted buttons) behaves the same as the flat list it replaces;
// windowing still kicks in for a roster large enough to exceed it.
const OVERSCAN = 30

// A sentinel row scrolling into view is the trigger to fetch its page's continuation; the roster and
// the Archive each hold their own sentinel and fetch callback.
//
// The range is the virtualizer's visible range, never its mounted items: virtual-core applies the
// overscan after computing that range (`defaultRangeExtractor`), so a sentinel 30 rows below the fold
// is mounted and counted as reached. The roster then grew a page before the reader had scrolled at
// all, and kept growing a page per read while the sentinel sat in the overscan band.
//
// The effect depends on the two indices rather than on the range object or the item array: both are
// rebuilt on every render, so depending on either asked for the next page again each render for as
// long as the sentinel stayed on screen (#2277).
function useSentinelFetch(options: {
  rows: readonly RosterRow[]
  kind: RosterRow['kind']
  range: { startIndex: number; endIndex: number } | null
  onFetch: () => void
}) {
  const { rows, kind, range, onFetch } = options
  const sentinelIndex = rows.findIndex((row) => row.kind === kind)
  const start = range?.startIndex ?? -1
  const end = range?.endIndex ?? -1
  const reached = sentinelIndex !== -1 && sentinelIndex >= start && sentinelIndex <= end
  // The callback is read through a ref rather than depended on: its identity changes on every render
  // of the sidebar, so depending on it asked for a page per render while the sentinel stayed in view.
  // The row count is a dependency, because a sentinel still visible after a page landed is a reader
  // who has scrolled past everything loaded and wants the next one.
  const latest = useRef(onFetch)
  latest.current = onFetch
  const loaded = rows.length
  useEffect(() => {
    if (reached && loaded > 0) latest.current()
  }, [reached, loaded])
}

export function RosterVirtualList({
  label,
  onArchive,
  onFetchMoreSessions,
  onFetchNextPage,
  onFocus,
  onLinkTicket,
  onOpenTicket,
  onRename,
  onSelect,
  onToggleSelect,
  onUnlinkTicket,
  renamedTitles,
  rows,
  selectedIds,
  selectedSessionId,
  tabStop,
}: RosterRowHandlers & {
  label: string
  onFetchMoreSessions: () => void
  onFetchNextPage: () => void
  renamedTitles: Record<string, string>
  rows: readonly RosterRow[]
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
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

  return (
    <div
      className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
      data-slot="roster-scroll"
      ref={scrollRef}
    >
      <RosterContextMenu
        onArchive={onArchive}
        onLinkTicket={onLinkTicket}
        onOpenTicket={onOpenTicket}
        onRename={onRename}
        onUnlinkTicket={onUnlinkTicket}
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
                      selectedIds={selectedIds}
                      selectedSessionId={selectedSessionId}
                      tabStop={tabStop}
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
