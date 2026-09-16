import { useInfiniteQuery } from '@tanstack/react-query'
import { useWatchedQueries } from '@/renderer/core/hooks/use-watched-topic'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { sessionArchiveQueryKey } from '../session-queries'
import type { SessionArchiveListed, SessionId } from '../types'

type ArchivePage = Pick<SessionArchiveListed, 'sessions' | 'nextCursor' | 'restored'>

// Archived Sessions are read on demand, one page per fetch, rather than on every roster read
// (#1593). `restoreId` asks the reader to hand back a Session's row even when it falls outside
// the pages already loaded, so a previously selected archived Session can be shown restored
// without paging through everything to find it.
export function useArchivedSessions(enabled: boolean, restoreId: SessionId | null) {
  const query = useInfiniteQuery<ArchivePage, SessionContractError>({
    queryKey: sessionArchiveQueryKey(restoreId),
    enabled,
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

  // An archived Session's row sits under the same watched trees as an active one, so the row being
  // viewed is read again when a CLI writes rather than twice a second. Each tick paid for a whole
  // discovery pass, which made this the most expensive of the polls #2303 removed. Browsing the
  // paged list carries no restoreId and stays read on demand, as it was under the poll.
  useWatchedQueries('sessions', restoreId === null ? [] : [sessionArchiveQueryKey(restoreId)])

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
