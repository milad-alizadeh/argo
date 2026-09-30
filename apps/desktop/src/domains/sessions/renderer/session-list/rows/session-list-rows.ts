import type { Session, SessionId } from '../../types'
import type { SelectionModifier } from '../hooks/session-list-selection'

// What the one Session list context menu does to the row under the pointer.
export type SessionListMenuHandlers = {
  onArchive: (sessionId: SessionId) => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session) => void
}

// Every row-level handler the sessionList's render chain threads down, named once so no module between
// SessionList and the row it reaches re-declares the shape (#2284).
export type SessionListRowHandlers = SessionListMenuHandlers & {
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
}

// A Session's name: its title, else `startingLabel` while starting, never the temporary id (#2430).
export function sessionName(
  session: Pick<Session, 'id' | 'status' | 'title'>,
  startingLabel: string,
): string {
  if (session.title !== null) return session.title.text
  return session.status === 'starting' ? startingLabel : session.id
}

// One row of the list, for the virtualizer's estimate and for the spinner and skeleton rows.
export const SESSION_LIST_ROW_HEIGHT = 56
