import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import {
  invalidateSessionRoster,
  SESSION_REFRESH_MS,
  sessionFeedQueryKey,
  sessionRosterQueryKey,
} from '../session-queries'
import type { SessionFeed, SessionId, SessionsListed } from '../types'

let nextRequest = 0
function requestId(name: string): string {
  nextRequest += 1
  return `${name}-${nextRequest}`
}

// The Roster is a reading of files Argo does not own and cannot be told about: it changes only
// when the reader asks for another pass or a mutation invalidates its query.
export function useSessions(selectedSessionId: SessionId | null) {
  const queryClient = useQueryClient()
  const roster = useQuery<SessionsListed, SessionContractError>({
    queryKey: sessionRosterQueryKey,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const reply = await window.argo.listSessions({
        version: 1,
        type: 'session.list',
        requestId: requestId('list'),
      })
      switch (reply.type) {
        case 'session.listed':
          return reply
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const feed = useQuery<SessionFeed | null, SessionContractError>({
    queryKey:
      selectedSessionId === null
        ? ['sessions', 'feed', null]
        : sessionFeedQueryKey(selectedSessionId),
    enabled: selectedSessionId !== null,
    refetchInterval: SESSION_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      if (selectedSessionId === null) return null
      const key = sessionFeedQueryKey(selectedSessionId)
      const cached = queryClient.getQueryData<SessionFeed>(key)
      const reply = await window.argo.readSessionFeed({
        version: 1,
        type: 'session.feed',
        requestId: requestId('feed'),
        sessionId: selectedSessionId,
        revision: cached?.revision ?? null,
      })
      switch (reply.type) {
        case 'session.feed.read':
          return reply
        case 'session.feed.unchanged':
          return cached ?? null
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })

  return {
    roster: roster.error === null ? (roster.data ?? null) : null,
    rosterError: roster.error,
    feed: feed.error === null ? (feed.data ?? null) : null,
    feedError: feed.error,
    reread: () => invalidateSessionRoster(queryClient),
  }
}
