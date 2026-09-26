import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionFeedQuery } from '../feed/session-feed-query'
import type { Session, SessionId } from '../types'
import { useConsecutiveFeedFailures, useSessions } from '../use-sessions'
import { useArchivedSection } from './archived/use-archived-section'
import { useSessionListStatus } from './hooks/use-session-list-filter-store'
import { RenameDialog } from './rename/rename-dialog'
import { useRenameDialog } from './rename/use-rename-dialog'
import type { SessionListActions } from './rows/session-list-actions'
import { SessionListOutcome } from './rows/session-list-outcome'
import { sessionListRows } from './rows/session-list-rows'
import { sessionListState } from './rows/session-list-status-row'
import { SessionListVirtualList } from './rows/session-list-virtual-list'
import { SessionsSidebarHeader } from './sidebar/sessions-sidebar-chrome'
import { useSidebarSessionList } from './sidebar/use-sidebar-session-list'

export type { SessionListActions } from './rows'

const NOOP = () => {}

function useSessionListRead() {
  return useSessions(null, true)
}

function useSessionListRows(options: {
  read: ReturnType<typeof useSessionListRead>
  search: ReturnType<typeof useSidebarSessionList>['searched'] | null
  selectedSessionId: SessionId | null
  visible: readonly Session[]
}) {
  const { read, search, selectedSessionId, visible } = options
  const visibleSessionIds = useMemo(() => visible.map((session) => session.id), [visible])
  const status = useSessionListStatus()
  const archived = useArchivedSection(
    selectedSessionId,
    visibleSessionIds,
    read.sessionList !== null,
  )
  const rows = useMemo(
    () =>
      sessionListRows({
        active: visible,
        archived,
        hasMoreSessions: read.hasMoreSessions,
        isFetchingMoreSessions: read.isFetchingMoreSessions,
        search,
        showArchive: read.sessionList !== null,
        status,
      }),
    [
      archived,
      read.hasMoreSessions,
      read.isFetchingMoreSessions,
      read.sessionList,
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

function useSessionListSessions(options: {
  actions: SessionListActions
  projectRoot: string | null
  read: ReturnType<typeof useSessionListRead>
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const { actions, projectRoot, read, selectedSessionId, sidebar } = options
  const sessions = useSidebarSessionList({
    onArchiveSelected: actions.onArchiveSelected,
    onSelect: actions.onSelect,
    projectRoot,
    sessionList: read.sessionList,
    sessionListError: read.sessionListError,
    selectedSessionId,
    sidebar,
  })
  const rows = useSessionListRows({
    read,
    search: sessions.searching ? sessions.searched : null,
    selectedSessionId,
    visible: sessions.visible,
  })
  return { ...sessions, ...rows }
}

function useUnavailableSessionIds(selectedSessionId: SessionId | null) {
  const queryClient = useQueryClient()
  const selectedFeed = useQuery(sessionFeedQuery(queryClient, selectedSessionId, null))
  const failedFeedReads = useConsecutiveFeedFailures(selectedSessionId, selectedFeed)
  const [unavailableSessionIds, setUnavailableSessionIds] = useState<ReadonlySet<SessionId>>(
    () => new Set(),
  )
  useEffect(() => {
    if (selectedSessionId === null) return
    const unavailable = failedFeedReads > 1 && selectedFeed.error?.code === 'missing-session'
    if (!unavailable && !selectedFeed.isSuccess) return
    setUnavailableSessionIds((current) => {
      if (unavailable === current.has(selectedSessionId)) return current
      const next = new Set(current)
      if (unavailable) next.add(selectedSessionId)
      else next.delete(selectedSessionId)
      return next
    })
  }, [failedFeedReads, selectedFeed.error?.code, selectedFeed.isSuccess, selectedSessionId])
  return unavailableSessionIds
}

// The sidebar header, outcome and rows, under one named record of row actions (#2284).
export function SessionList({
  actions,
  projectRoot,
  selectedSessionId,
}: {
  actions: SessionListActions
  projectRoot: string | null
  selectedSessionId: SessionId | null
}) {
  const sidebar = useRef<HTMLElement>(null)
  const unavailableSessionIds = useUnavailableSessionIds(selectedSessionId)
  const read = useSessionListRead()
  const sessions = useSessionListSessions({
    actions,
    projectRoot,
    read,
    selectedSessionId,
    sidebar,
  })
  const { renameTarget, setRenameTarget, handleRename } = useRenameDialog(
    sessions.rename,
    actions.onRename,
  )
  return (
    <aside
      aria-label={useTranslation('sessions').t('sidebarLabel')}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
      data-state={sessionListState(read.sessionList, read.sessionListError, sessions.sessionCount)}
      ref={sidebar}
    >
      <SessionsSidebarHeader
        onNew={actions.onNew}
        onSearch={sessions.setSearch}
        onStatusChange={sessions.setStatus}
        search={sessions.search}
        status={sessions.status}
      />
      <SessionListOutcome
        count={sessions.sessionCount}
        sessionList={read.sessionList}
        sessionListError={read.sessionListError}
        status={sessions.status}
      />
      <SessionListVirtualList
        label="Sessions"
        unavailableSessionIds={unavailableSessionIds}
        onArchive={sessions.archive}
        onFetchMoreSessions={read.fetchMoreSessions}
        onFetchNextPage={sessions.onFetchNextPage}
        onFetchNextSearchPage={sessions.onFetchNextSearchPage}
        onFocus={sessions.focus.setFocusedSessionId}
        onOpenTicket={actions.onOpenTicket}
        onRename={setRenameTarget}
        onSelect={sessions.select}
        onToggleSelect={sessions.selection.toggle}
        renamedTitles={sessions.renamedTitles}
        rows={sessions.rows}
        selectedIds={sessions.selection.selectedIds}
        selectedSessionId={selectedSessionId}
        tabStop={sessions.focus.tabStop}
      />
      <RenameDialog onRename={handleRename} session={renameTarget} setSession={setRenameTarget} />
    </aside>
  )
}
