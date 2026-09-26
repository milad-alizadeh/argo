import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sessionFeedQuery } from '../feed/session-feed-query'
import { useConsecutiveFeedFailures } from '../feed/use-session-feed'
import type { Session, SessionId } from '../types'
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
import { useSessionList } from './use-session-list'

export type { SessionListActions } from './rows'

function useSessionListRows(options: {
  read: ReturnType<typeof useSessionList>
  searching: boolean
  selectedSessionId: SessionId | null
  visible: readonly Session[]
}) {
  const { read, searching, selectedSessionId, visible } = options
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
        searching,
        showArchive: read.sessionList !== null,
        status,
      }),
    [
      archived,
      read.hasMoreSessions,
      read.isFetchingMoreSessions,
      read.sessionList,
      searching,
      visible,
      status,
    ],
  )
  return {
    rows,
    onFetchNextPage: archived.fetchNextPage,
  }
}

function useSessionListSessions(options: {
  actions: SessionListActions
  read: ReturnType<typeof useSessionList>
  search: string
  selectedSessionId: SessionId | null
  sidebar: RefObject<HTMLElement | null>
}) {
  const { actions, read, search, selectedSessionId, sidebar } = options
  const sessions = useSidebarSessionList({
    onArchiveSelected: actions.onArchiveSelected,
    onSelect: actions.onSelect,
    search,
    sessionList: read.sessionList,
    sessionListError: read.sessionListError,
    selectedSessionId,
    sidebar,
  })
  const rows = useSessionListRows({
    read,
    searching: sessions.searching,
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

function sessionListData(read: ReturnType<typeof useSessionList>, sessionCount: number) {
  return {
    'data-page-count': read.loadedSessionPages,
    'data-state': sessionListState(read.sessionList, read.sessionListError, sessionCount),
    'data-total': read.sessionList?.total,
  }
}

// The sidebar header, outcome and rows, under one named record of row actions (#2284).
type SessionListProps = {
  actions: SessionListActions
  projectId: string | null
  selectedSessionId: SessionId | null
}

function SessionListHeader({
  actions,
  read,
  search,
  sessions,
  setSearch,
}: {
  actions: SessionListActions
  read: ReturnType<typeof useSessionList>
  search: string
  sessions: ReturnType<typeof useSessionListSessions>
  setSearch: (search: string) => void
}) {
  return (
    <SessionsSidebarHeader
      onNew={actions.onNew}
      onRefresh={read.refreshSessions}
      onSearch={setSearch}
      onStatusChange={sessions.setStatus}
      refreshing={read.refreshingSessions}
      search={search}
      status={sessions.status}
    />
  )
}

export function SessionList({ actions, projectId, selectedSessionId }: SessionListProps) {
  const sidebar = useRef<HTMLElement>(null)
  const [search, setSearch] = useState('')
  const read = useSessionList({
    projectId,
    search: search.trim(),
  })
  const sessions = useSessionListSessions({
    actions,
    read,
    search,
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
      {...sessionListData(read, sessions.sessionCount)}
      ref={sidebar}
    >
      <SessionListHeader {...{ actions, read, search, sessions, setSearch }} />
      <SessionListOutcome
        count={sessions.sessionCount}
        sessionList={read.sessionList}
        sessionListError={read.sessionListError}
        status={sessions.status}
      />
      <SessionListVirtualList
        label="Sessions"
        unavailableSessionIds={useUnavailableSessionIds(selectedSessionId)}
        onArchive={sessions.archive}
        onFetchMoreSessions={read.fetchMoreSessions}
        onFetchNextPage={sessions.onFetchNextPage}
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
