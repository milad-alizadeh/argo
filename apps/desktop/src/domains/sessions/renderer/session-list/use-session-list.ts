import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { sessionError } from '@/domains/sessions/api/session-error'
import { trpc } from '@/platform/renderer/trpc-client'
import { useSessionSync } from './use-session-sync'

function nextPageOf(page: { page: number; pageSize: number; total: number }) {
  return page.page * page.pageSize < page.total ? page.page + 1 : null
}

export function useSessionList({
  projectId,
  enabled = true,
  search = '',
}: {
  projectId: string | null
  enabled?: boolean
  search?: string
}) {
  const sync = useSessionSync()
  const query = useInfiniteQuery({
    ...trpc.sessionList.infiniteQueryOptions(
      { projectId: projectId ?? 'unselected', search },
      {
        initialCursor: 1,
        getNextPageParam: nextPageOf,
      },
    ),
    enabled: enabled && projectId !== null,
    staleTime: Infinity,
  })
  const lastPage = query.data?.pages.at(-1)
  const error = query.error === null ? null : sessionError('internal-error', null)
  const sessionList = useMemo(() => {
    if (lastPage === undefined || error !== null) return null
    const nextPage = nextPageOf(lastPage)
    return {
      total: lastPage.total,
      sessions: query.data?.pages.flatMap((page) => page.rows) ?? [],
      nextPage,
      historyComplete: nextPage === null,
    }
  }, [error, lastPage, query.data?.pages])
  return {
    sessionList,
    sessionListError: error,
    loadedSessionPages: query.data?.pages.length ?? 0,
    hasMoreSessions: query.hasNextPage,
    isFetchingMoreSessions: query.isFetchingNextPage,
    fetchMoreSessions: useCallback(() => {
      if (!query.hasNextPage || query.isFetchingNextPage) return
      void query.fetchNextPage()
    }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]),
    refreshSessions: sync.refresh,
    refreshingSessions: sync.refreshing,
    syncStatus: sync.status,
  }
}
