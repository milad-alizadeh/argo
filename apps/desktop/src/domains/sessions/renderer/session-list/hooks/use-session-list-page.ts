import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { useSessionCreationStore } from '../../session-creation'
import { useWatchedQueries } from '../../use-watched-topic'
import { useSessionListFilterStore } from './use-session-list-filter-store'
import { useSessionListSelection } from './use-session-list-selection'

const PAGE_SIZE = 50

function sessionListOptions(
  projectId: string | null,
  search: string,
  status: 'active' | 'archived' | 'all',
) {
  return {
    queryKey: trpc.sessions.list.queryKey({ projectId, search, status }),
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      trpcClient.sessions.list.query({
        page: pageParam,
        pageSize: PAGE_SIZE,
        projectId,
        search,
        status,
      }),
    getNextPageParam: (lastPage: Awaited<ReturnType<typeof trpcClient.sessions.list.query>>) =>
      lastPage.page * lastPage.pageSize < lastPage.indexedTotal ? lastPage.page + 1 : undefined,
  }
}

export function useSessionListPage(projectId: string | null, selectedSessionId: string | null) {
  const [search, setSearch] = useState('')
  const status = useSessionListFilterStore((state) => state.status)
  const setStatus = useSessionListFilterStore((state) => state.setStatus)
  const pending = useSessionCreationStore((state) => state.pending)
  useWatchedQueries('sessions', [
    trpc.sessions.list.queryKey({ projectId, search, status }),
    trpc.sessionSyncStatus.queryKey(),
  ])
  const syncStatus = useQuery(trpc.sessionSyncStatus.queryOptions())
  const sessionList = useInfiniteQuery(sessionListOptions(projectId, search, status))
  const indexed = useMemo(
    () => sessionList.data?.pages.flatMap((page) => page.sessions) ?? [],
    [sessionList.data],
  )
  useEffect(() => {
    if (pending?.stage === 'reconciling' && indexed.some(({ argoId }) => argoId === pending.id))
      useSessionCreationStore.getState().confirmed(pending.id)
  }, [indexed, pending])
  const visible = useMemo(() => {
    if (
      pending === null ||
      status === 'archived' ||
      search.trim().length > 0 ||
      indexed.some(({ argoId }) => argoId === pending.id)
    )
      return indexed
    return [pending, ...indexed]
  }, [indexed, pending, search, status])
  const selectableIds = visible
    .filter((session) => 'argoId' in session && !session.archived)
    .map((session) => ('argoId' in session ? session.argoId : session.id))
  const selection = useSessionListSelection(selectableIds, selectedSessionId)
  return { search, setSearch, status, setStatus, syncStatus, sessionList, visible, selection }
}
