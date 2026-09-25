// One read of the Session roster. The reply's transport envelope is dropped here, so that a read
// that finds nothing new republishes the roster it already holds (#2241).
import type { InfiniteData, UseInfiniteQueryOptions } from '@tanstack/react-query'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../../session-contract-error'
import { sessionRosterQueryKey } from '../../session-queries'
import type { SessionRoster } from '../../types'

type RosterQuerySource = {
  projectRoot: string | null
}

export function sessionRosterQuery(
  enabled: boolean,
  { projectRoot }: RosterQuerySource,
): UseInfiniteQueryOptions<
  SessionRoster,
  SessionContractError,
  InfiniteData<SessionRoster>,
  readonly unknown[],
  string | null
> {
  return {
    queryKey: [...sessionRosterQueryKey, projectRoot],
    staleTime: Infinity,
    enabled,
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
    // Nothing here re-reads on a timer. The transcript trees bring a new Session in, and the window
    // taking focus and the machine waking cover what a lost watch missed (platform/main/watch, #2303).
    retry: false,
    queryFn: async ({ pageParam }) => {
      const reply = await window.argo.listSessions({ projectRoot, cursor: pageParam })
      switch (reply.type) {
        case 'session.listed':
          return {
            sessions: reply.sessions,
            filesFound: reply.filesFound,
            filesRead: reply.filesRead,
            filesUnreadable: reply.filesUnreadable,
            filesParsed: reply.filesParsed,
            nextCursor: reply.nextCursor,
            historyComplete: reply.historyComplete,
            partialFailures: reply.partialFailures,
          }
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  }
}
