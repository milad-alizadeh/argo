import { useInfiniteQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { sessionError } from '@/domains/sessions/api/session-error'
import { type RouterOutputs, trpcClient } from '@/platform/renderer/trpc-client'
import { SessionContractError } from '../../session-contract-error'
import { sessionArchiveQueryKey } from '../../session-queries'
import type { SessionId } from '../../types'

type ArchivePage = RouterOutputs['sessionArchiveList']

// Archived Sessions are read on demand, one page per fetch, rather than on every Session list read
// (#1593). `restoreId` asks the reader to hand back a Session's row even when it falls outside
// the pages already loaded, so a previously selected archived Session can be shown restored
// without paging through everything to find it.
export function useArchivedSessions(enabled: boolean, restoreId: SessionId | null) {
  const { projectId = 'unscoped' } = useParams()
  const query = useInfiniteQuery<ArchivePage>({
    queryKey: sessionArchiveQueryKey(restoreId),
    enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: ({ pageParam }) =>
      trpcClient.sessionArchiveList.query({
        projectId,
        cursor: pageParam as string | null,
        restoreId,
      }),
  })

  const seen = new Set<string>()
  const sessions = (query.data?.pages.flatMap((page) => page.sessions) ?? []).filter((session) => {
    if (seen.has(session.id)) return false
    seen.add(session.id)
    return true
  })
  const restored = query.data?.pages.find((page) => page.restored !== null)?.restored ?? null
  // The most recently read page's word on it: backfill (#2373) can turn this true between one
  // fetch and the next, and only the latest read says where it stands right now.
  const historyComplete = query.data?.pages.at(-1)?.historyComplete ?? true

  return {
    sessions,
    restored,
    historyComplete,
    isLoading: enabled && query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
    error:
      enabled && query.error !== null
        ? new SessionContractError({
            ...sessionError('internal-error', null),
            message: query.error.message,
          })
        : null,
  }
}
