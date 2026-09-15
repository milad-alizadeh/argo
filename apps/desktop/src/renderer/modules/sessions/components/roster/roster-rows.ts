import type { SessionContractError } from '../../session-contract-error'
import type { SelectionModifier } from '../../state/roster-selection'
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
  onToggleArchived: () => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  onUnlinkTicket: (session: Session) => void
}

export type RosterRow =
  | { kind: 'session'; session: Session; archived: boolean }
  | { kind: 'archivedToggle'; open: boolean }
  | { kind: 'archivedLoading' }
  | { kind: 'archivedError'; error: SessionContractError }
  | { kind: 'archivedEmpty' }
  | { kind: 'archivedSentinel' }
  | { kind: 'archivedLoadingMore' }

// The Archived section shares the same scrollable list as the active roster (#2194 follow-up),
// so it contributes rows to this one array instead of a separately scrolled block: a disclosure
// row, then whichever of its own load states applies, in the order the reader would read them.
export function rosterRows({
  active,
  archivedOpen,
  archived,
}: {
  active: readonly Session[]
  archivedOpen: boolean
  archived: {
    displayed: readonly Session[]
    error: SessionContractError | null
    hasNextPage: boolean
    isFetchingNextPage: boolean
    isLoading: boolean
  }
}): RosterRow[] {
  const rows: RosterRow[] = active.map((session) => ({
    kind: 'session',
    session,
    archived: false,
  }))
  rows.push({ kind: 'archivedToggle', open: archivedOpen })
  if (!archivedOpen) return rows
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
