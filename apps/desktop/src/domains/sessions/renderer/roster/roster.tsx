import { type RefObject, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session, SessionId } from '../types'
import { useArchivedSection } from './archived/use-archived-section'
import { useRosterStatus } from './hooks/use-roster-filter-store'
import { RenameDialog } from './rename/rename-dialog'
import { useRenameDialog } from './rename/use-rename-dialog'
import type { RosterActions } from './rows/roster-actions'
import { useOrderedSessions } from './rows/roster-order'
import { RosterOutcome } from './rows/roster-outcome'
import { rosterRows } from './rows/roster-rows'
import { rosterState } from './rows/roster-status-row'
import { RosterVirtualList } from './rows/roster-virtual-list'
import { SessionsSidebarHeader } from './sidebar/sessions-sidebar-chrome'
import { useSidebarRoster } from './sidebar/use-sidebar-roster'

export type { RosterActions } from './rows'

const NOOP = () => {}

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

// The sidebar header, outcome and rows, under one named record of row actions (#2284).
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
        queryFailure={read.rosterFailure}
        roster={read.roster}
        status={sessions.status}
      />
      <RosterVirtualList
        label="Sessions"
        onArchive={sessions.archive}
        onFetchMoreSessions={read.fetchMoreSessions}
        onFetchNextPage={onFetchNextPage}
        onFetchNextSearchPage={onFetchNextSearchPage}
        onFocus={sessions.focus.setFocusedSessionId}
        onLinkTicket={actions.onLinkTicket}
        onOpenTicket={actions.onOpenTicket}
        onRename={setRenameTarget}
        onSelect={sessions.select}
        onToggleSelect={sessions.selection.toggle}
        onUnlinkTicket={actions.onUnlinkTicket}
        renamedTitles={sessions.renamedTitles}
        rows={rows}
        selectedIds={sessions.selection.selectedIds}
        selectedSessionId={selectedSessionId}
        tabStop={sessions.focus.tabStop}
      />
      <RenameDialog onRename={handleRename} session={renameTarget} setSession={setRenameTarget} />
    </aside>
  )
}
