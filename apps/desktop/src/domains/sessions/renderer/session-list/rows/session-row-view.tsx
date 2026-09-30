import { memo } from 'react'
import type { Session, SessionId } from '../../types'
import type { SelectionModifier } from '../hooks/session-list-selection'
import { SessionRow } from './session-row'

// The row reads its own place in the list as three booleans rather than the ids they come from: an
// id would re-render all 82 rows when the reader opened one Session, since every row compares it.
type SessionRowViewProps = {
  checked: boolean
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  selected: boolean
  session: Session
  tabbable: boolean
  unavailable: boolean
}

// Memoized, because a Harness driving a Session writes several times a second, and each read
// rebuilds the list. A Session the read did not touch keeps its identity through the query's
// structural sharing, so its row draws nothing.
export const SessionRowView = memo(function SessionRowView({
  checked,
  onFocus,
  onSelect,
  onToggleSelect,
  selected,
  session,
  tabbable,
  unavailable,
}: SessionRowViewProps) {
  return (
    <SessionRow
      archived={session.archived}
      checked={checked}
      onFocus={() => onFocus(session.id)}
      onSelect={() => onSelect(session.id)}
      onToggleSelect={(modifier) => onToggleSelect(session.id, modifier)}
      selectable={!session.archived}
      selected={selected}
      session={session}
      tabIndex={tabbable ? 0 : -1}
      unavailable={unavailable}
    />
  )
})
