import { type RefObject, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRosterStatus } from '../../state/use-roster-filter-store'
import type { Session, SessionId } from '../../types'
import { RenameDialog } from './rename-dialog'
import { useOrderedSessions } from './roster-order'
import { RosterOutcome } from './roster-outcome'
import { rosterRows } from './roster-rows'
import { RosterVirtualList } from './roster-virtual-list'
import { rosterState, SessionsSidebarHeader } from './sessions-sidebar-chrome'
import { useArchivedSection } from './use-archived-section'
import { useSidebarRoster } from './use-sidebar-roster'

// The one named record of row actions Roster takes from its caller: everything else a row does
// (focus, selection, opening the rename dialog, paging) is this module's own concern (#2284).
export type RosterActions = {
  onArchiveSelected: (sessionIds: SessionId[]) => void
  onLinkTicket: (session: Session) => void
  onNew: () => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session, name: string) => Promise<string>
  onSelect: (sessionId: SessionId) => void
  onUnlinkTicket: (session: Session) => void
}

const NOOP = () => {}

// The rows the virtual list draws, kept apart from Roster's own body so the memo dependency list
// (each row object is what the memoized RosterRowView compares against) reads as one seam rather
// than adding to the function the row-action wiring already fills.
function useRosterRows(options: {
  read: ReturnType<typeof useOrderedSessions>
  search: ReturnType<typeof useSidebarRoster>['searched'] | null
  selectedSessionId: SessionId | null
  visible: readonly Session[]
}) {
  const { read, search, selectedSessionId, visible } = options
  const visibleSessionIds = useMemo(() => visible.map((session) => session.id), [visible])
  const status = useRosterStatus()
  const archived = useArchivedSection(selectedSessionId, visibleSessionIds, read.roster !== null)
  const rows = useMemo(
    () =>
      rosterRows({
        active: visible,
        archived,
        hasMoreSessions: read.hasMoreSessions,
        isFetchingMoreSessions: read.isFetchingMoreSessions,
        search,
        showArchive: read.roster !== null,
        status,
      }),
    [
      archived,
      read.hasMoreSessions,
      read.isFetchingMoreSessions,
      read.roster,
      search,
      visible,
      status,
    ],
  )
  return {
    rows,
    onFetchNextPage: archived.fetchNextPage,
    onFetchNextSearchPage: search?.fetchNextPage ?? NOOP,
  }
}

// The rename dialog's own state and submit handler, kept apart from Roster's body for the same
// reason as useRosterRows: wiring, not the component's own logic.
function useRenameDialog(
  rename: (sessionId: SessionId, title: string) => void,
  onRename: RosterActions['onRename'],
) {
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const handleRename = useCallback(
    async (session: Session, name: string) => rename(session.id, await onRename(session, name)),
    [rename, onRename],
  )
  return { renameTarget, setRenameTarget, handleRename }
}

// Assembles useSidebarRoster's options, kept apart from Roster's own body for the same reason as
// useRosterRows: it is wiring, not the component's own logic, and Roster's function body cannot
// absorb it without exceeding the 50-line cap.
function useRosterSessions(options: {
  actions: RosterActions
  projectRoot: string | null
  read: ReturnType<typeof useOrderedSessions>
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const { actions, projectRoot, read, selectedSessionId, sidebar } = options
  return useSidebarRoster({
    onArchiveSelected: actions.onArchiveSelected,
    onSelect: actions.onSelect,
    projectRoot,
    roster: read.roster,
    rosterError: read.rosterError,
    selectedSessionId,
    sidebar,
  })
}

// The Roster: the sidebar's header, its outcome (loading, empty, failed), and its rows, reading its
// own Session list for the given Project and rendering it under one named record of row actions.
// The sidebar content, the rows module, the virtual list and the row view that used to sit between
// this and a rendered row all fold into it (#2284).
export function Roster({
  actions,
  projectRoot,
  selectedSessionId,
}: {
  actions: RosterActions
  projectRoot: string | null
  selectedSessionId: SessionId | null
}) {
  const sidebar = useRef<HTMLElement>(null)
  const read = useOrderedSessions(projectRoot)
  const sessions = useRosterSessions({ actions, projectRoot, read, selectedSessionId, sidebar })
  const { focus, selection } = sessions
  const { onFetchNextPage, onFetchNextSearchPage, rows } = useRosterRows({
    read,
    search: sessions.searching ? sessions.searched : null,
    selectedSessionId,
    visible: sessions.visible,
  })
  const { renameTarget, setRenameTarget, handleRename } = useRenameDialog(
    sessions.rename,
    actions.onRename,
  )
  return (
    <aside
      aria-label={useTranslation('sessions').t('sidebarLabel')}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
      data-state={rosterState(read.roster, read.rosterError, sessions.sessionCount)}
      ref={sidebar}
    >
      <SessionsSidebarHeader
        onNew={actions.onNew}
        onSearch={sessions.setSearch}
        onStatusChange={sessions.setStatus}
        search={sessions.search}
        status={sessions.status}
      />
      <RosterOutcome
        count={sessions.sessionCount}
        roster={read.roster}
        rosterError={read.rosterError}
        status={sessions.status}
      />
      <RosterVirtualList
        label="Sessions"
        onArchive={sessions.archive}
        onFetchMoreSessions={read.fetchMoreSessions}
        onFetchNextPage={onFetchNextPage}
        onFetchNextSearchPage={onFetchNextSearchPage}
        onFocus={focus.setFocusedSessionId}
        onLinkTicket={actions.onLinkTicket}
        onOpenTicket={actions.onOpenTicket}
        onRename={setRenameTarget}
        onSelect={sessions.select}
        onToggleSelect={selection.toggle}
        onUnlinkTicket={actions.onUnlinkTicket}
        renamedTitles={sessions.renamedTitles}
        rows={rows}
        selectedIds={selection.selectedIds}
        selectedSessionId={selectedSessionId}
        tabStop={focus.tabStop}
      />
      <RenameDialog onRename={handleRename} session={renameTarget} setSession={setRenameTarget} />
    </aside>
  )
}
