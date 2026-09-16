import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef } from 'react'
import type { SelectionModifier } from '../../state/roster-selection'
import type { SessionId } from '../../types'
import { ArchivedSectionRow } from './archived-status-row'
import { moveFocus } from './roster-arrow-keys'
import { RosterContextMenu } from './roster-context-menu'
import {
  ROSTER_ROW_HEIGHT,
  type RosterRow,
  type RosterRowHandlers,
  renamedSession,
} from './roster-rows'
import { SessionRosterItem } from './session-roster-item'
import { RosterLoadingMoreRow } from './sessions-sidebar-chrome'
import { useSentinelFetch } from './use-roster-sentinel-fetch'

// Memoized, because a read of the open Session re-renders an ancestor the roster shares with it, and
// without this every mounted row re-rendered with it: 185291 renders in a 13-second idle recording,
// when those reads still polled at 500ms. Nothing re-reads on a timer now (#2299, #2303), so the
// reads are a CLI's writes, but a Session being driven writes several times a second.
const RosterRowView = memo(function RosterRowView({
  onFocus,
  onSelect,
  onToggleSelect,
  renamedTitles,
  row,
  selectedIds,
  selectedSessionId,
  tabStop,
}: {
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  renamedTitles: Record<string, string>
  row: RosterRow
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
}) {
  if (row.kind === 'archivedSentinel' || row.kind === 'rosterSentinel') {
    return <div aria-hidden="true" />
  }
  if (row.kind === 'rosterLoadingMore') return <RosterLoadingMoreRow />
  if (row.kind !== 'session') return <ArchivedSectionRow row={row} />
  const { session, archived } = row
  const selectable = !archived
  return (
    <SessionRosterItem
      archived={archived}
      checked={selectable && selectedIds.has(session.id)}
      onFocus={() => onFocus(session.id)}
      onSelect={() => onSelect(session.id)}
      onToggleSelect={(modifier) => onToggleSelect(session.id, modifier)}
      selectable={selectable}
      selected={session.id === selectedSessionId}
      session={renamedSession(session, renamedTitles)}
      tabIndex={session.id === tabStop ? 0 : -1}
    />
  )
})

// Overscan generous enough to keep a roster's realistic session count fully mounted, so arrow-key
// navigation (which walks the mounted buttons) behaves the same as the flat list it replaces;
// windowing still kicks in for a roster large enough to exceed it.
const OVERSCAN = 30

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
