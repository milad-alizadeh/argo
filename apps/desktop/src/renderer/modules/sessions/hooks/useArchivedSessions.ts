import { useInfiniteQuery } from '@tanstack/react-query'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { SESSION_REFRESH_MS, sessionArchiveQueryKey } from '../session-queries'
import type { SessionArchiveListed, SessionId } from '../types'

type ArchivePage = Pick<SessionArchiveListed, 'sessions' | 'nextCursor' | 'restored'>

// Archived Sessions are read on demand, one page per fetch, rather than on every roster poll
// (#1593). `restoreId` asks the reader to hand back a Session's row even when it falls outside
// the pages already loaded, so a previously selected archived Session can be shown restored
// without paging through everything to find it.
export function useArchivedSessions(enabled: boolean, restoreId: SessionId | null) {
  const query = useInfiniteQuery<ArchivePage, SessionContractError>({
    queryKey: sessionArchiveQueryKey(restoreId),
    enabled,
    // A restoreId asks for one specific Session's row (the one being viewed), so it is polled the
    // same as the active roster's selected Session: an open plan or a running compaction still
    // reads live even though the Session sits in the Archive. Browsing the paged list carries no
    // restoreId and is read on demand only (#1593).
    refetchInterval: restoreId === null ? false : SESSION_REFRESH_MS,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      const reply = await window.argo.listArchivedSessions({
        cursor: pageParam as string | null,
        restoreId,
      })
      switch (reply.type) {
        case 'session.archive.listed':
          return reply
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })

  const seen = new Set<string>()
  const sessions = (query.data?.pages.flatMap((page) => page.sessions) ?? []).filter((session) => {
    if (seen.has(session.id)) return false
    seen.add(session.id)
    return true
  })
  const restored = query.data?.pages.find((page) => page.restored !== null)?.restored ?? null

  return {
    sessions,
    restored,
    isLoading: enabled && query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
    error: enabled ? query.error : null,
  }
}
