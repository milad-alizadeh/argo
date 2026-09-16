// One read of the Session roster. The reply's transport envelope is dropped here, so that a poll
// that finds nothing new republishes the roster it already holds (#2241).
import { keepPreviousData, type UseQueryOptions } from '@tanstack/react-query'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { ROSTER_FALLBACK_REFRESH_MS, sessionRosterQueryKey } from '../session-queries'
import { isOptimisticSessionId } from '../state/use-session-creation-store'
import type { SessionId, SessionRoster } from '../types'

type RosterQuerySource = {
  cursor: string | null
  projectRoot: string | null
}

export function sessionRosterQuery(
  selectedSessionId: SessionId | null,
  enabled: boolean,
  { projectRoot, cursor }: RosterQuerySource,
): UseQueryOptions<SessionRoster, SessionContractError> {
  return {
    // The cursor is part of the identity of what was read, not a parameter smuggled past it. A key
    // that omitted it made every window the same cache entry, so a reader growing the window and a
    // poll refreshing it fought over one slot, and `refetch` re-ran whichever queryFn closure the
    // last render had built rather than the cursor just chosen.
    queryKey: [...sessionRosterQueryKey, projectRoot, cursor],
    staleTime: Infinity,
    enabled,
    // Growing the window is a new key, so without this the roster would blank to its skeleton and
    // the reader would lose their scroll position every time they reached the end. The previous
    // window stays on screen until the larger one lands, and `isPlaceholderData` is what tells the
    // list a larger window is still in flight.
    placeholderData: keepPreviousData,
    // A watch on the transcript trees is what brings a new Session in, so this only catches what no
    // watch reports. A draft Session has no backend record, so it cannot reconcile from a poll at
    // all, and re-reading every file for it is wasted work.
    refetchInterval:
      selectedSessionId !== null && isOptimisticSessionId(selectedSessionId)
        ? false
        : ROSTER_FALLBACK_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      const reply = await window.argo.listSessions({ projectRoot, cursor })
      switch (reply.type) {
        case 'session.listed':
          return {
            sessions: reply.sessions,
            filesFound: reply.filesFound,
            filesRead: reply.filesRead,
            filesUnreadable: reply.filesUnreadable,
            nextCursor: reply.nextCursor,
          }
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  }
}
