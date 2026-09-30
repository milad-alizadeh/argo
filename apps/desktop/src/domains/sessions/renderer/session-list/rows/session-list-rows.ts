import type { Session, SessionId } from '../../types'

// What the one Session list context menu does to the row under the pointer.
export type SessionListMenuHandlers = {
  onArchive: (sessionId: SessionId) => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session) => void
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
