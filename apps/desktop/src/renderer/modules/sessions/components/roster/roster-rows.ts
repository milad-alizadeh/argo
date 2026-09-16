import type { SessionContractError } from '../../session-contract-error'
import type { SelectionModifier } from '../../state/roster-selection'
import {
  type RosterStatus,
  showsActive,
  showsArchived,
} from '../../state/use-roster-filter-store'
import type { Session, SessionId } from '../../types'

// The row handlers RosterVirtualList threads down to RosterRowView unchanged (#2194 follow-up):
// named once so the two components declare the shape a single time between them.
export type RosterRowHandlers = {
  onArchive: (sessionId: SessionId) => void
  onFocus: (sessionId: SessionId) => void
  onLinkTicket: (session: Session) => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  onUnlinkTicket: (session: Session) => void
}

export type RosterRow =
  | { kind: 'session'; session: Session; archived: boolean }
  | { kind: 'rosterSentinel' }
  | { kind: 'archivedLoading' }
  | { kind: 'archivedError'; error: SessionContractError }
  | { kind: 'archivedEmpty' }
  | { kind: 'archivedSentinel' }
  | { kind: 'archivedLoadingMore' }

// The status filter chooses which Sessions the one list carries. The Archive used to be a
// disclosure row inside it, which made the reader open a place in the list rather than choose what
// the list was of; the filter in the header decides now and there is no toggle row.
export function rosterRows({
  active,
  archived,
  hasMoreSessions,
  showArchive,
  status,
}: {
  active: readonly Session[]
  archived: {
    displayed: readonly Session[]
    error: SessionContractError | null
    hasNextPage: boolean
    isFetchingNextPage: boolean
    isLoading: boolean
  }
  hasMoreSessions: boolean
  showArchive: boolean
  status: RosterStatus
}): RosterRow[] {
  const rows: RosterRow[] = showsActive(status)
    ? active.map((session) => ({ kind: 'session', session, archived: false }))
    : []
  // Scrolling this row into view is the reader action that grows the active roster's own bounded
  // window (#2239); it carries no loaded rows itself, so it is never mistaken for one.
  if (showsActive(status) && hasMoreSessions) rows.push({ kind: 'rosterSentinel' })
  // The initial roster load draws its own skeleton (sessions-sidebar-chrome.tsx), so the Archive's
  // own outcome stays off the list until the roster has resolved once (#2239).
  if (!showArchive || !showsArchived(status)) return rows
  if (archived.isLoading) {
    rows.push({ kind: 'archivedLoading' })
    return rows
  }
  if (archived.error !== null) {
    rows.push({ kind: 'archivedError', error: archived.error })
    return rows
  }
  if (archived.displayed.length === 0) {
    rows.push({ kind: 'archivedEmpty' })
    return rows
  }
  for (const session of archived.displayed) rows.push({ kind: 'session', session, archived: true })
  if (archived.hasNextPage) rows.push({ kind: 'archivedSentinel' })
  if (archived.isFetchingNextPage) rows.push({ kind: 'archivedLoadingMore' })
  return rows
}
