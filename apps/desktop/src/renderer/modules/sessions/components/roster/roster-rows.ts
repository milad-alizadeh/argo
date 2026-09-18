import type { SessionContractError } from '../../session-contract-error'
import type { SelectionModifier } from '../../state/roster-selection'
import { type RosterStatus, showsActive, showsArchived } from '../../state/use-roster-filter-store'
import type { Session, SessionId } from '../../types'

// What the one roster context menu does to the row under the pointer.
export type RosterMenuHandlers = {
  onArchive: (sessionId: SessionId) => void
  onLinkTicket: (session: Session) => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session) => void
  onUnlinkTicket: (session: Session) => void
}

// Every row-level handler the roster's render chain threads down, named once so no module between
// Roster and the row it reaches re-declares the shape (#2284).
export type RosterRowHandlers = RosterMenuHandlers & {
  onFetchMoreSessions: () => void
  onFocus: (sessionId: SessionId) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
}

// What a reader calls a Session: the row's label, and the name of the menu that opens on it.
export function sessionName(session: Session): string {
  return session.title?.text ?? session.id
}

// The title a reader gave a Session in this window, which the read itself does not carry yet.
export function renamedSession(session: Session, renamedTitles: Record<string, string>): Session {
  const title = renamedTitles[session.id]
  if (title === undefined) return session
  return { ...session, title: { text: title, source: 'custom' } }
}

// One row of the list, for the virtualizer's estimate and for every status row that stands where a
// Session would: a spinner row is the size of the row it waits for.
export const ROSTER_ROW_HEIGHT = 56

export type RosterRow =
  | { kind: 'session'; session: Session; archived: boolean }
  | { kind: 'rosterSentinel' }
  | { kind: 'rosterLoadingMore' }
  | { kind: 'archivedLoading' }
  | { kind: 'archivedError'; error: SessionContractError }
  | { kind: 'archivedEmpty' }
  | { kind: 'archivedSentinel' }
  | { kind: 'archivedLoadingMore' }
  | { kind: 'archivedIndexing' }

// Two rows draw the same thing. A roster read rebuilds every row object when one Session changes,
// so the row's memo boundary compares what the row draws rather than the object it arrived in
// (#2386). A Session that the read did not touch keeps its own identity, which is what makes this
// comparison a pointer comparison rather than a walk.
export function sameRosterRow(left: RosterRow, right: RosterRow): boolean {
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
  row: RosterRow,
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

type ArchivedSection = {
  displayed: readonly Session[]
  error: SessionContractError | null
  hasNextPage: boolean
  historyComplete: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
}

// The Archive's own rows, given the roster has resolved once and the filter shows it.
function archivedRows(archived: ArchivedSection): RosterRow[] {
  if (archived.isLoading) return [{ kind: 'archivedLoading' }]
  if (archived.error !== null) return [{ kind: 'archivedError', error: archived.error }]
  if (archived.displayed.length === 0) {
    return [archived.historyComplete ? { kind: 'archivedEmpty' } : { kind: 'archivedIndexing' }]
  }
  const rows: RosterRow[] = archived.displayed.map((session) => ({
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

// The status filter chooses which Sessions the one list carries. The Archive used to be a
// disclosure row inside it, which made the reader open a place in the list rather than choose what
// the list was of; the filter in the header decides now and there is no toggle row.
export function rosterRows({
  active,
  archived,
  hasMoreSessions,
  isFetchingMoreSessions,
  showArchive,
  status,
}: {
  active: readonly Session[]
  archived: ArchivedSection
  hasMoreSessions: boolean
  isFetchingMoreSessions: boolean
  showArchive: boolean
  status: RosterStatus
}): RosterRow[] {
  const rows: RosterRow[] = showsActive(status)
    ? active.map((session) => ({ kind: 'session', session, archived: false }))
    : []
  // Scrolling this row into view is the reader action that grows the active roster's own bounded
  // window (#2239); it carries no loaded rows itself, so it is never mistaken for one.
  if (showsActive(status) && hasMoreSessions) rows.push({ kind: 'rosterSentinel' })
  // The spinner is the bottom of the list while the next window arrives, standing where the rows it
  // waits for will be, rather than a bar pinned under the list.
  if (showsActive(status) && isFetchingMoreSessions) rows.push({ kind: 'rosterLoadingMore' })
  // The initial roster load draws its own skeleton (sessions-sidebar-chrome.tsx), so the Archive's
  // own outcome stays off the list until the roster has resolved once (#2239).
  if (!showArchive || !showsArchived(status)) return rows
  return [...rows, ...archivedRows(archived)]
}
