import type { SessionContractError } from '../../session-contract-error'
import type { Session, SessionId, SessionListRetainedWindow } from '../../types'
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
  // A list position outside the retained window: it holds the scroll extent until it is read.
  | { kind: 'sessionPlaceholder'; index: number }
  | { kind: 'archivedLoading' }
  | { kind: 'archivedError'; error: SessionContractError }
  | { kind: 'archivedEmpty' }
  | { kind: 'archivedSentinel' }
  | { kind: 'archivedLoadingMore' }
  | { kind: 'archivedIndexing' }

// Two rows draw the same thing. A Session list read rebuilds every row object when one Session changes,
// so the row's memo boundary compares what the row draws rather than the object it arrived in
// (#2386). A Session that the read did not touch keeps its own identity, which is what makes this
// comparison a pointer comparison rather than a walk.
export function sameSessionListRow(left: SessionListRow, right: SessionListRow): boolean {
  switch (left.kind) {
    case 'session':
      return (
        right.kind === 'session' &&
        left.session === right.session &&
        left.archived === right.archived
      )
    case 'sessionPlaceholder':
      return right.kind === 'sessionPlaceholder' && left.index === right.index
    case 'archivedError':
      return right.kind === 'archivedError' && left.error === right.error
    case 'archivedLoading':
    case 'archivedEmpty':
    case 'archivedSentinel':
    case 'archivedLoadingMore':
    case 'archivedIndexing':
      return left.kind === right.kind
  }
}

// The virtualizer's key, read once per row so a Session that changes index (the list re-sorts by
// activity) keeps its DOM node instead of swapping into whatever node the array's next index now
// holds. A placeholder is keyed by its position; every other row kind stands at most once.
export function sessionListRowKey(row: SessionListRow): string {
  switch (row.kind) {
    case 'session':
      return row.session.id
    case 'sessionPlaceholder':
      return `placeholder-${row.index}`
    case 'archivedLoading':
    case 'archivedError':
    case 'archivedEmpty':
    case 'archivedSentinel':
    case 'archivedLoadingMore':
    case 'archivedIndexing':
      return row.kind
  }
}

// An active list position, read or not; the Archive and status rows follow the run of these.
export function isActiveListPosition(row: SessionListRow): boolean {
  return row.kind === 'sessionPlaceholder' || (row.kind === 'session' && !row.archived)
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

// The Archive's own rows, once the active Session list has resolved once.
function archivedSessionListRows(archived: ArchivedSessionListState): SessionListRow[] {
  if (archived.isLoading) return [{ kind: 'archivedLoading' }]
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
  if (archived.isFetchingNextPage) rows.push({ kind: 'archivedLoadingMore' })
  // Reaching the end of what a source's index has backfilled so far is not reaching the end of the
  // Archive (#2374): say so rather than letting the list look exhaustive while it is only current.
  if (!archived.hasNextPage && !archived.isFetchingNextPage && !archived.historyComplete) {
    rows.push({ kind: 'archivedIndexing' })
  }
  return rows
}

// Every position of the active list, whether or not the retained window holds its row, so the
// scroll extent is the list's and never the window's.
function activeSessionListRows(active: SessionListRetainedWindow): SessionListRow[] {
  return Array.from(
    { length: Math.max(active.total, active.offset + active.sessions.length) },
    (_, index) => {
      const session = active.sessions[index - active.offset]
      return session === undefined
        ? { kind: 'sessionPlaceholder', index }
        : { kind: 'session', session, archived: false }
    },
  )
}

// The status filter chooses which Sessions the one list carries. A search shows only the
// matching active rows, so selection and virtualization stay on the same list.
export function sessionListRows({
  active,
  archived,
  searching,
  showArchive,
  status,
}: {
  active: SessionListRetainedWindow
  archived: ArchivedSessionListState
  searching: boolean
  showArchive: boolean
  status: SessionListStatus
}): SessionListRow[] {
  const rows = showsActive(status) ? activeSessionListRows(active) : []
  if (searching) return rows
  // The initial Session list load draws its own skeleton (session-list-status-row.tsx), so the Archive's
  // own outcome stays off the list until the Session list has resolved once (#2239).
  if (!showArchive || !showsArchived(status)) return rows
  return [...rows, ...archivedSessionListRows(archived)]
}
