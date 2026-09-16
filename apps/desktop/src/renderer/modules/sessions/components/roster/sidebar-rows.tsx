import type { SelectionModifier } from '../../state/roster-selection'
import { useRosterStatus } from '../../state/use-roster-filter-store'
import type { Session, SessionId, SessionsListed } from '../../types'
import { rosterRows } from './roster-rows'
import { RosterVirtualList } from './roster-virtual-list'
import { useArchivedSection } from './use-archived-section'

export function SidebarRows({
  hasMoreSessions,
  onArchive,
  onFetchMoreSessions,
  onFocus,
  onRename,
  onOpenTicket,
  onLinkTicket,
  onUnlinkTicket,
  onSelect,
  onToggleSelect,
  renamedTitles,
  selectedIds,
  selectedSessionId,
  showArchive,
  tabStop,
  visible,
}: {
  hasMoreSessions: boolean
  onArchive: (sessionId: SessionId) => void
  onFetchMoreSessions: () => void
  onFocus: (sessionId: SessionId) => void
  onRename: (session: Session) => void
  onOpenTicket: (session: Session) => void
  onLinkTicket: (session: Session) => void
  onUnlinkTicket: (session: Session) => void
  onSelect: (sessionId: SessionId) => void
  onToggleSelect: (sessionId: SessionId, modifier: SelectionModifier) => void
  renamedTitles: Record<string, string>
  selectedIds: ReadonlySet<SessionId>
  selectedSessionId: SessionId | null
  showArchive: boolean
  tabStop: SessionId | null
  visible: SessionsListed['sessions']
}) {
  const visibleSessionIds = visible.map((session) => session.id)
  const status = useRosterStatus()
  const archived = useArchivedSection(selectedSessionId, visibleSessionIds, showArchive)
  const rows = rosterRows({
    active: visible,
    archived,
    hasMoreSessions,
    showArchive,
    status,
  })

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
      selectedIds={selectedIds}
      selectedSessionId={selectedSessionId}
      tabStop={tabStop}
    />
  )
}
