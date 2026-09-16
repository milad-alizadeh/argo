import { memo } from 'react'
import type { SelectionModifier } from '../../state/roster-selection'
import type { SessionId } from '../../types'
import { ArchivedSectionRow } from './archived-status-row'
import { type RosterRow, renamedSession } from './roster-rows'
import { SessionRosterItem } from './session-roster-item'
import { RosterLoadingMoreRow } from './sessions-sidebar-chrome'

// Memoized, because a read of the open Session re-renders an ancestor the roster shares with it, and
// without this every mounted row re-rendered with it: 185291 renders in a 13-second idle recording,
// when those reads still polled at 500ms. Nothing re-reads on a timer now (#2299, #2303), so the
// reads are a CLI's writes, but a Session being driven writes several times a second.
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
