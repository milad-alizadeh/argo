import { useMemo } from 'react'
import type { SelectionModifier } from '../../state/roster-selection'
import { useRosterStatus } from '../../state/use-roster-filter-store'
import type { Session, SessionId } from '../../types'
import { rosterRows } from './roster-rows'
import { RosterVirtualList } from './roster-virtual-list'
import { useArchivedSection } from './use-archived-section'
import type { useSidebarRoster } from './use-sidebar-roster'

export function SidebarRows({
  hasMoreSessions,
  isFetchingMoreSessions,
  onArchive,
  onFetchMoreSessions,
  onFocus,
  onRename,
  onOpenTicket,
  onLinkTicket,
  onUnlinkTicket,
  onSelect,
  onToggleSelect,
  roster,
  selectedSessionId,
  showArchive,
}: {
  hasMoreSessions: boolean
  isFetchingMoreSessions: boolean
  onArchive: (sessionId: SessionId) => void
  onFetchMoreSessions: () => void
  onFocus: (sessionId: SessionId) => void
  onRename: (session: Session) => void
  onOpenTicket: (session: Session) => void
  onLinkTicket: (session: Session) => void
  onUnlinkTicket: (session: Session) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  roster: ReturnType<typeof useSidebarRoster>
  selectedSessionId: SessionId | null
  showArchive: boolean
}) {
  const { renamedTitles, selection, visible } = roster
  const visibleSessionIds = visible.map((session) => session.id)
  const status = useRosterStatus()
  const archived = useArchivedSection(selectedSessionId, visibleSessionIds, showArchive)
  // Each row object is what the memoized RosterRowView compares against, so rebuilding the array on
  // every render would defeat the memo and re-render every mounted row on each 500ms poll tick.
  const rows = useMemo(
    () =>
      rosterRows({
        active: visible,
        archived,
        hasMoreSessions,
        isFetchingMoreSessions,
        showArchive,
        status,
      }),
    [archived, hasMoreSessions, isFetchingMoreSessions, showArchive, status, visible],
  )

  return (
    <RosterVirtualList
      label="Sessions"
      onArchive={onArchive}
      onFetchMoreSessions={onFetchMoreSessions}
      onFetchNextPage={archived.fetchNextPage}
      onFocus={onFocus}
      onLinkTicket={onLinkTicket}
      onOpenTicket={onOpenTicket}
      onRename={onRename}
      onSelect={onSelect}
      onToggleSelect={onToggleSelect}
      onUnlinkTicket={onUnlinkTicket}
      renamedTitles={renamedTitles}
      rows={rows}
      selectedIds={selection.selectedIds}
      selectedSessionId={selectedSessionId}
      tabStop={roster.focus.tabStop}
    />
  )
}
