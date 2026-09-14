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
  ordered.push(...unmatched)
  rosterOrder = ordered.map((session) => session.id)
  return ordered
}

export type SessionRoster = SessionsListed | null

export function useSessions(selectedSessionId: SessionId | null) {
  const queryClient = useQueryClient()
  const roster = useQuery<SessionsListed, SessionContractError>({
    queryKey: sessionRosterQueryKey,
    staleTime: Infinity,
    refetchInterval: selectedSessionId === null ? false : SESSION_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      const reply = await window.argo.listSessions()
      switch (reply.type) {
        case 'session.listed':
          return { ...reply, sessions: keepRosterOrder(reply.sessions) }
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
    queryFn: async ({ signal }) => {
      if (selectedSessionId === null) return null
      const key = sessionFeedQueryKey(selectedSessionId)
      const cached = queryClient.getQueryData<SessionFeed>(key)
      // The abort TanStack Query fires on a query-key change (switching Sessions) or unmount
      // only stops the renderer from waiting on this promise; it does not reach the main
      // process, so the settle loop there keeps running a read nothing will draw (#2102). This
      // turns that local abort into the IPC call that actually stops it.
      const onAbort = () => void window.argo.cancelSessionFeed({ sessionId: selectedSessionId })
      signal.addEventListener('abort', onAbort)
      const reply = await window.argo
        .readSessionFeed({
          sessionId: selectedSessionId,
          revision: cached?.revision ?? null,
        })
        .finally(() => signal.removeEventListener('abort', onAbort))
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
    // A poll racing the transcript another live process is actively writing can fail once and
    // recover on the next, whether or not a prior read already landed: the first open of an
    // actively driven Session races the same writer every other poll does (#2053, #2071).
    // `failureCount` is consecutive failed fetches and resets to 0 on the next success.
    feed: feed.data ?? null,
    feedError: feed.failureCount > 1 ? feed.error : null,
    reread: () => invalidateSessionRoster(queryClient),
    // A read that never answers (#2102) leaves this query itself pending forever; a stalled
    // reader's retry needs a fresh attempt, which only a refetch starts.
    retryFeed: () => void feed.refetch(),
  }
}
