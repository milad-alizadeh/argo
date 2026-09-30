import { useMemo } from 'react'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionListStatus } from './hooks/use-session-list-filter-store'
import { useSessionListQuery } from './session-list-query'
import { useSessionSync } from './use-session-sync'

export function useSessionList({
  projectId,
  enabled = true,
  filter = 'active',
  search = '',
}: {
  projectId: string | null
  enabled?: boolean
  filter?: SessionListStatus
  search?: string
}) {
  const sync = useSessionSync()
  const query = useSessionListQuery(
    { projectId: projectId ?? '', filter, search },
    enabled && projectId !== null,
  )
  const error = query.isError ? sessionError('internal-error', null) : null
  const sessionList = useMemo(() => {
    const pages = query.data?.pages
    if (pages === undefined || error !== null) return null
    const sessions = pages.flatMap((page) => page.rows)
    const total = pages[0]?.total ?? 0
    return { total, sessions, historyComplete: sessions.length >= total }
  }, [error, query.data])
  const hasMoreSessions = query.hasNextPage
  const isFetchingMoreSessions = query.isFetchingNextPage
  const { fetchNextPage } = query
  return {
    sessionList,
    sessionListError: error,
    loadedSessionPages: query.data?.pages.length ?? 0,
    hasMoreSessions,
    isFetchingMoreSessions,
    fetchMoreSessions: useMemo(
      () => () => {
        if (hasMoreSessions && !isFetchingMoreSessions) void fetchNextPage()
      },
      [fetchNextPage, hasMoreSessions, isFetchingMoreSessions],
    ),
    refreshSessions: sync.refresh,
    refreshingSessions: sync.refreshing,
    syncStatus: sync.status,
  }
}
