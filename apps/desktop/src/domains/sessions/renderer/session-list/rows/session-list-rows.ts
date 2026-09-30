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
  onFetchMoreSessions: () => void
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId, retiredIds?: SessionId[]) => void
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

// The title a reader gave a Session in this window, which the read itself does not carry yet.
export function renamedSession(session: Session, renamedTitles: Record<string, string>): Session {
  const title = renamedTitles[session.id]
  if (title === undefined) return session
  return { ...session, title: { text: title, source: 'custom' } }
}

// One row of the list, for the virtualizer's estimate and for every status row that stands where a
// Session would: a spinner row is the size of the row it waits for.
export const SESSION_LIST_ROW_HEIGHT = 56

export type SessionListRow =
  | { kind: 'session'; session: Session; archived: boolean }
  | { kind: 'sessionListSentinel' }
  | { kind: 'sessionListLoadingMore' }

// Two rows draw the same thing. A Session list read rebuilds every row object when one Session changes,
// so the row's memo boundary compares what the row draws rather than the object it arrived in
// (#2386). A Session that the read did not touch keeps its own identity, which is what makes this
// comparison a pointer comparison rather than a walk.
export function sameSessionListRow(left: SessionListRow, right: SessionListRow): boolean {
  if (left.kind === 'session') {
    return (
      right.kind === 'session' && left.session === right.session && left.archived === right.archived
    )
  }
  return left.kind === right.kind
}

// The virtualizer's key, read once per row so a Session that changes index (the list re-sorts by
// activity) keeps its DOM node instead of swapping into whatever node the array's next index now
// holds. Every other row kind stands at most once in the list, so its own kind is unique enough.
export function sessionListRowKey(row: SessionListRow): string {
  return row.kind === 'session' ? row.session.id : row.kind
}

// What a row is in the list right now: picked out in bulk, open, and holding the list's one tab stop.
export function rowPlace(
  row: SessionListRow,
  list: {
    selectedIds: ReadonlySet<SessionId>
    selectedSessionId: SessionId | null
    tabStop: SessionId | null
  },
) {
  if (row.kind !== 'session') return { checked: false, selected: false, tabbable: false }
  return {
    checked: !row.archived && list.selectedIds.has(row.session.id),
    selected: row.session.id === list.selectedSessionId,
    tabbable: row.session.id === list.tabStop,
  }
}

// The rows the filter and search left, then the row that loads more and its spinner.
export function sessionListRows({
  sessions,
  hasMoreSessions,
  isFetchingMoreSessions,
}: {
  sessions: readonly Session[]
  hasMoreSessions: boolean
  isFetchingMoreSessions: boolean
}): SessionListRow[] {
  const rows: SessionListRow[] = sessions.map((session) => ({
    kind: 'session',
    session,
    archived: session.archived,
  }))
  // Scrolling this row into view loads the next page; it carries no loaded rows itself.
  if (hasMoreSessions) rows.push({ kind: 'sessionListSentinel' })
  if (isFetchingMoreSessions) rows.push({ kind: 'sessionListLoadingMore' })
  return rows
}
