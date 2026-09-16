import { memo } from 'react'
import type { SelectionModifier } from '../../state/roster-selection'
import type { SessionId } from '../../types'
import { ArchivedSectionRow } from './archived-status-row'
import { type RosterRow, renamedSession } from './roster-rows'
import { SessionRosterItem } from './session-roster-item'
import { RosterLoadingMoreRow } from './sessions-sidebar-chrome'

// Memoized, because the sidebar re-renders about thirteen times a second while nothing happens: the
// open Session's feed and permission reads poll every 500ms (SESSION_REFRESH_MS) and re-render an
// ancestor the roster shares with them. Without this every mounted row re-rendered on each of those
// ticks: 185291 renders in a 13-second idle recording.
export const RosterRowView = memo(function RosterRowView({
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

  const session = row.session
  const selectable = !row.archived
  return (
    <SessionRosterItem
      archived={row.archived}
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
