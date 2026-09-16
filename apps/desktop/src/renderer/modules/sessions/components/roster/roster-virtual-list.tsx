import { useVirtualizer } from '@tanstack/react-virtual'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionId } from '../../types'
import { RosterRowView } from './roster-row-view'
import type { RosterRow, RosterRowHandlers } from './roster-rows'

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

// A sentinel row's appearance among the mounted virtual items is the trigger to fetch its page's
// continuation; the roster and the Archive each hold their own sentinel and fetch callback.
//
// The effect depends on whether the sentinel is mounted, never on the array of mounted items:
// `getVirtualItems` returns a fresh array on every render, so depending on it re-ran the effect on
// every render and asked for the next page again each time, for as long as the sentinel stayed on
// screen (#2277).
function useSentinelFetch(options: {
  rows: readonly RosterRow[]
  kind: RosterRow['kind']
  items: readonly { index: number }[]
  onFetch: () => void
}) {
  const { rows, kind, items, onFetch } = options
  const sentinelIndex = rows.findIndex((row) => row.kind === kind)
  const mounted = sentinelIndex !== -1 && items.some((item) => item.index === sentinelIndex)
  useEffect(() => {
    if (mounted) onFetch()
  }, [mounted, onFetch])
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
    estimateSize: () => 56,
    overscan: OVERSCAN,
  })
  const items = virtualizer.getVirtualItems()
  useSentinelFetch({ rows, kind: 'rosterSentinel', items, onFetch: onFetchMoreSessions })
  useSentinelFetch({ rows, kind: 'archivedSentinel', items, onFetch: onFetchNextPage })

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-3" ref={scrollRef}>
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
                    onArchive={onArchive}
                    onFocus={onFocus}
                    onLinkTicket={onLinkTicket}
                    onOpenTicket={onOpenTicket}
                    onRename={onRename}
                    onSelect={onSelect}
                    onToggleSelect={onToggleSelect}
                    onUnlinkTicket={onUnlinkTicket}
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
    </div>
  )
}
