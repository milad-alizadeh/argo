import type { SessionContractError } from '../../session-contract-error'
import type { Session, SessionId } from '../../types'
import type { SelectionModifier } from '../hooks/session-list-selection'
import {
  type SessionListStatus,
  showsActive,
  showsArchived,
} from '../hooks/use-session-list-filter-store'

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
  | { kind: 'archivedLoading' }
  | { kind: 'archivedError'; error: SessionContractError }
  | { kind: 'archivedEmpty' }
  | { kind: 'archivedSentinel' }
  | { kind: 'archivedLoadingMore' }
  | { kind: 'archivedIndexing' }
  | { kind: 'searchEmpty' }

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
  if (left.kind === 'archivedError') {
    return right.kind === 'archivedError' && left.error === right.error
  }
  return left.kind === right.kind
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

type ArchivedSessionListState = {
  displayed: readonly Session[]
  error: SessionContractError | null
  hasNextPage: boolean
  historyComplete: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
}

// The Archive's own rows, once the active Session list has resolved once. `sessionListLoadingMoreShown` says
// the active sessionList's own loader already stands at the bottom of the list, so the Archive's own
// loader waits its turn rather than stacking a second, identical spinner under it (#2412).
function archivedSessionListRows(
  archived: ArchivedSessionListState,
  sessionListLoadingMoreShown: boolean,
): SessionListRow[] {
  if (archived.isLoading) return sessionListLoadingMoreShown ? [] : [{ kind: 'archivedLoading' }]
  if (archived.error !== null) return [{ kind: 'archivedError', error: archived.error }]
  if (archived.displayed.length === 0) {
    return [archived.historyComplete ? { kind: 'archivedEmpty' } : { kind: 'archivedIndexing' }]
  }
  const rows: SessionListRow[] = archived.displayed.map((session) => ({
    kind: 'session',
    session,
    archived: true,
  }))
  if (archived.hasNextPage) rows.push({ kind: 'archivedSentinel' })
  if (archived.isFetchingNextPage && !sessionListLoadingMoreShown)
    rows.push({ kind: 'archivedLoadingMore' })
  // Reaching the end of what a source's index has backfilled so far is not reaching the end of the
  // Archive (#2374): say so rather than letting the list look exhaustive while it is only current.
  if (
    !archived.hasNextPage &&
    !(archived.isFetchingNextPage && !sessionListLoadingMoreShown) &&
    !archived.historyComplete
  ) {
    rows.push({ kind: 'archivedIndexing' })
  }
  return rows
}

// The status filter chooses which Sessions the one list carries. A title search filters its loaded
// active rows in place, so selection and virtualization stay on the same list.
export function sessionListRows({
  active,
  archived,
  hasMoreSessions,
  isFetchingMoreSessions,
  searching,
  showArchive,
  status,
}: {
  active: readonly Session[]
  archived: ArchivedSessionListState
  hasMoreSessions: boolean
  isFetchingMoreSessions: boolean
  searching: boolean
  showArchive: boolean
  status: SessionListStatus
}): SessionListRow[] {
  const rows: SessionListRow[] = showsActive(status)
    ? active.map((session) => ({ kind: 'session', session, archived: false }))
    : []
  if (searching) return rows.length === 0 ? [{ kind: 'searchEmpty' }] : rows
  // Scrolling this row into view is the reader action that grows the active sessionList's own bounded
  // window (#2239); it carries no loaded rows itself, so it is never mistaken for one.
  if (showsActive(status) && hasMoreSessions) rows.push({ kind: 'sessionListSentinel' })
  // The spinner is the bottom of the list while the next window arrives, standing where the rows it
  // waits for will be, rather than a bar pinned under the list.
  const sessionListLoadingMoreShown = showsActive(status) && isFetchingMoreSessions
  if (sessionListLoadingMoreShown) rows.push({ kind: 'sessionListLoadingMore' })
  // The initial Session list load draws its own skeleton (session-list-status-row.tsx), so the Archive's
  // own outcome stays off the list until the Session list has resolved once (#2239).
  if (!showArchive || !showsArchived(status)) return rows
  return [...rows, ...archivedSessionListRows(archived, sessionListLoadingMoreShown)]
}
