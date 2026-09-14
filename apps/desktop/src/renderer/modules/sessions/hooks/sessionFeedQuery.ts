// One read of one Feed document, whether it is a Session's own or one Subagent's (#1582). Both
// callers share this so the revision handshake, which answers `session.feed.unchanged` and expects
// the holder to keep what it already has, is written once.
import type { QueryClient, UseQueryOptions } from '@tanstack/react-query'
import { mergeAppendedFeed } from '@/core/sessions/feed-contract'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import { SESSION_REFRESH_MS, sessionFeedQueryKey } from '../session-queries'
import type { SessionFeed, SessionId } from '../types'

export function sessionFeedQuery(
  queryClient: QueryClient,
  sessionId: SessionId | null,
  delegationId: string | null,
): UseQueryOptions<SessionFeed | null, SessionContractError> {
  return {
    queryKey:
      sessionId === null
        ? ['sessions', 'feed', null, delegationId]
        : sessionFeedQueryKey(sessionId, delegationId),
    enabled: sessionId !== null,
    refetchInterval: SESSION_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      if (sessionId === null) return null
      const key = sessionFeedQueryKey(sessionId, delegationId)
      const cached = queryClient.getQueryData<SessionFeed>(key)
      const reply = await window.argo.readSessionFeed({
        sessionId,
        delegationId,
        revision: cached?.revision ?? null,
      })
      switch (reply.type) {
        case 'session.feed.read':
          return reply
        // The server only sends this once it has seen this exact revision back from us, which
        // means the cached read it was built from is the one still in the query cache.
        case 'session.feed.appended':
          return mergeAppendedFeed(cached, reply)
        case 'session.feed.unchanged':
          return cached ?? null
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  }
}
