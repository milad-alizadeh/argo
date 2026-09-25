import { memo } from 'react'
import type { SessionId } from '../../types'
import type { SelectionModifier } from '../hooks/session-list-selection'
import { ArchivedSectionRow } from './archived-status-row'
import { renamedSession, type SessionListRow, sameSessionListRow } from './session-list-rows'
import { SessionListLoadingMoreRow } from './session-list-status-row'
import { SessionRow } from './session-row'

// The row reads its own place in the list as three booleans rather than the ids they come from: an
// id would re-render all 82 rows when the reader opened one Session, since every row compares it.
type SessionRowViewProps = {
  checked: boolean
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId, retiredIds?: SessionId[]) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  renamedTitles: Record<string, string>
  row: SessionListRow
  selected: boolean
  tabbable: boolean
  unavailable: boolean
}

// Everything but the row is compared by identity, and each of those is held stable by the hook that
// owns it. The row itself is rebuilt on every read, so it is the one prop compared by content.
function sameRowView(left: SessionRowViewProps, right: SessionRowViewProps): boolean {
  return (
    sameSessionListRow(left.row, right.row) &&
    left.checked === right.checked &&
    left.onFocus === right.onFocus &&
    left.onSelect === right.onSelect &&
    left.onToggleSelect === right.onToggleSelect &&
    left.renamedTitles === right.renamedTitles &&
    left.selected === right.selected &&
    left.tabbable === right.tabbable &&
    left.unavailable === right.unavailable
  )
}

// Memoized, because a read of the open Session re-renders an ancestor the Session list shares with it, and
// without this every mounted row re-rendered with it: 185291 renders in a 13-second idle recording,
// when those reads still polled at 500ms. Nothing re-reads on a timer now (#2299, #2303), so the
// reads are a Harness's writes, but a Session being driven writes several times a second.
export const SessionRowView = memo(function SessionRowView({
  checked,
  onFocus,
  onSelect,
  onToggleSelect,
  renamedTitles,
  row,
  selected,
  tabbable,
  unavailable,
}: SessionRowViewProps) {
  if (
    row.kind === 'archivedSentinel' ||
    row.kind === 'sessionListSentinel' ||
    row.kind === 'searchSentinel'
  ) {
    return <div aria-hidden="true" />
  }
  if (row.kind === 'sessionListLoadingMore') return <SessionListLoadingMoreRow />
  if (row.kind !== 'session') return <ArchivedSectionRow row={row} />
  const { session, archived } = row
  const selectable = !archived
  return (
    <SessionRow
      archived={archived}
      checked={checked}
      onFocus={() => onFocus(session.id)}
      onSelect={() => onSelect(session.id, session.retiredIds)}
      onToggleSelect={(modifier) => onToggleSelect(session.id, modifier)}
      selectable={selectable}
      selected={selected}
      session={renamedSession(session, renamedTitles)}
      tabIndex={tabbable ? 0 : -1}
      unavailable={unavailable}
    />
  )
}, sameRowView)
