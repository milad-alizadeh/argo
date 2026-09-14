import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import {
  invalidateSessionRoster,
  SESSION_REFRESH_MS,
  sessionRosterQueryKey,
} from '../session-queries'
import {
  mergeOptimisticRow,
  readableSessionId,
  useSessionCreationStore,
} from '../state/useSessionCreationStore'
import type { SessionFeed, SessionId, SessionsListed } from '../types'
import { sessionFeedQuery } from './sessionFeedQuery'

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

function useRosterQuery(selectedSessionId: SessionId | null, enabled: boolean) {
  return useQuery<SessionsListed, SessionContractError>({
    queryKey: sessionRosterQueryKey,
    staleTime: Infinity,
    enabled,
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
}

// The main column always reads the Session's own Feed. A Subagent's Feed is a separate document
// read beside it, drawn in the inspector, so opening one never takes the Session's away (#1582).
// A Session that only exists as an optimistic Roster row has no backend record to read a feed
// for yet (#2109); the backend is asked only once the id is a real one.
// `rosterEnabled` lets a caller that only sometimes needs the roster (a Ticket's Linked
// Sessions, unread until a Ticket is selected) skip the fetch rather than pull the whole
// roster in for a result it may throw away.
export function useSessions(selectedSessionId: SessionId | null, rosterEnabled = true) {
  const queryClient = useQueryClient()
  const roster = useRosterQuery(selectedSessionId, rosterEnabled)
  const feed = useQuery<SessionFeed | null, SessionContractError>(
    sessionFeedQuery(queryClient, readableSessionId(selectedSessionId), null),
  )

  const pending = useSessionCreationStore((state) => state.pending)
  const rosterData = roster.error === null ? (roster.data ?? null) : null
  const mergedRoster = useMemo(() => {
    if (rosterData === null) return null
    return { ...rosterData, sessions: mergeOptimisticRow(rosterData.sessions, pending) }
  }, [rosterData, pending])

  // The reader reported the real Session for itself: the synthetic row has done its job.
  useEffect(() => {
    if (pending?.stage !== 'reconciling') return
    if (rosterData?.sessions.some((session) => session.id === pending.id) !== true) return
    useSessionCreationStore.getState().confirmed(pending.id)
  }, [pending, rosterData])

  return {
    roster: mergedRoster,
    rosterError: roster.error,
    // A poll racing the transcript another live process is actively writing can fail once and
    // recover on the next, whether or not a prior read already landed: the first open of an
    // actively driven Session races the same writer every other poll does (#2053, #2071).
    // `failureCount` is consecutive failed fetches and resets to 0 on the next success.
    feed: feed.data ?? null,
    feedError: feed.failureCount > 1 ? feed.error : null,
    reread: () => invalidateSessionRoster(queryClient),
  }
}
