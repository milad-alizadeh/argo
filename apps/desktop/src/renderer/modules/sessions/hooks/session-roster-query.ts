// One read of the Session roster. The reply's transport envelope is dropped here, so that a poll
// that finds nothing new republishes the roster it already holds (#2241).
import type { UseQueryOptions } from '@tanstack/react-query'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { SESSION_REFRESH_MS, sessionRosterQueryKey } from '../session-queries'
import type { SessionId, SessionRoster, SessionsListed } from '../types'

let rosterOrder: SessionId[] = []

function keepRosterOrder(sessions: SessionsListed['sessions']) {
  const unmatched = [...sessions]
  const ordered = rosterOrder.flatMap((rememberedId) => {
    const index = unmatched.findIndex(
      (session) => session.id === rememberedId || session.retiredIds.includes(rememberedId),
    )
    if (index === -1) return []
    const session = unmatched.splice(index, 1)[0]
    return session === undefined ? [] : [session]
  })
  // A Session neither id nor retired-id matches is one the remembered order has never placed:
  // freshly discovered, or a restored archive row starting over. It leads the roster rather than
  // trailing it, so a newly observed Session reads at the top and the rest keep their fixed order.
  ordered.unshift(...unmatched)
  rosterOrder = ordered.map((session) => session.id)
  return ordered
}

export function sessionRosterQuery(
  selectedSessionId: SessionId | null,
  enabled: boolean,
  projectRoot: string | null,
): UseQueryOptions<SessionRoster, SessionContractError> {
  return {
    queryKey: [...sessionRosterQueryKey, projectRoot],
    staleTime: Infinity,
    enabled,
    refetchInterval: selectedSessionId === null ? false : SESSION_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      const reply = await window.argo.listSessions({ projectRoot })
      switch (reply.type) {
        case 'session.listed':
          return {
            sessions: keepRosterOrder(reply.sessions),
            filesFound: reply.filesFound,
            filesRead: reply.filesRead,
            filesUnreadable: reply.filesUnreadable,
          }
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  }
}
