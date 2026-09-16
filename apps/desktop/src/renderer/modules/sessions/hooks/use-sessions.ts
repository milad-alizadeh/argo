import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
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
} from '../state/use-session-creation-store'
import type { SessionFeed, SessionId, SessionsListed } from '../types'
import { retrySessionFeed, sessionFeedQuery } from './session-feed-query'

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

// A poll must refresh only the window this reader has already loaded, never regrow it, so the
// cursor that produced that window is held outside the query cache and resent unchanged on every
// poll (#2239). `fetchMore` is the only thing that advances it, in response to a reader action
// (scrolling to the end): it moves the cursor to the reply's own `nextCursor` before refetching, so
// the window that grows once then stays that size on every later poll.
function useRosterQuery(
  selectedSessionId: SessionId | null,
  enabled: boolean,
  projectRoot: string | null,
) {
  const cursorRef = useRef<string | null>(null)
  const previousProjectRoot = useRef(projectRoot)
  if (previousProjectRoot.current !== projectRoot) {
    previousProjectRoot.current = projectRoot
    cursorRef.current = null
  }

  const query = useQuery<SessionsListed, SessionContractError>({
    queryKey: [...sessionRosterQueryKey, projectRoot],
    staleTime: Infinity,
    enabled,
    refetchInterval: selectedSessionId === null ? false : SESSION_REFRESH_MS,
    retry: false,
    queryFn: async () => {
      const reply = await window.argo.listSessions({ projectRoot, cursor: cursorRef.current })
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

  const nextCursor = query.data?.nextCursor ?? null
  return {
    query,
    hasMore: nextCursor !== null,
    fetchMore: () => {
      if (nextCursor === null || query.isFetching) return
      cursorRef.current = nextCursor
      void query.refetch()
    },
  }
}

// The main column always reads the Session's own Feed. A Subagent's Feed is a separate document
// read beside it, drawn in the inspector, so opening one never takes the Session's away (#1582).
// A Session that only exists as an optimistic Roster row has no backend record to read a feed
// for yet (#2109); the backend is asked only once the id is a real one.
// `rosterEnabled` lets a caller that only sometimes needs the roster (a Ticket's Linked
// Sessions, unread until a Ticket is selected) skip the fetch rather than pull the whole
// roster in for a result it may throw away.
export function useSessions(
  selectedSessionId: SessionId | null,
  rosterEnabled = true,
  projectRoot: string | null = null,
) {
  const queryClient = useQueryClient()
  const selectedFeedId = readableSessionId(selectedSessionId)
  const {
    query: roster,
    hasMore: hasMoreSessions,
    fetchMore: fetchMoreSessions,
  } = useRosterQuery(selectedSessionId, rosterEnabled, projectRoot)
  const feedQuery = sessionFeedQuery(queryClient, selectedFeedId, null)
  const feed = useQuery<SessionFeed | null, SessionContractError>(feedQuery)

  // An already-settled read has no in-flight abort to notify the main process. Release it here
  // as well, so a Session switch or close drops its Feed rows and measurement state immediately.
  useEffect(() => {
    if (selectedFeedId === null) return
    return () => void window.argo.cancelSessionFeed({ sessionId: selectedFeedId })
  }, [selectedFeedId])

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
    hasMoreSessions,
    fetchMoreSessions,
    reread: () => invalidateSessionRoster(queryClient),
    // Cancel a read that never answers (#2102), because TanStack reuses a pending query without cached data.
    retryFeed: () => void retrySessionFeed(queryClient, feedQuery.queryKey, feed.refetch),
  }
}
