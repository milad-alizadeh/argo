import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import {
  retrySessionFeed,
  sessionFeedQuery,
} from '@/domains/sessions/renderer/feed/session-feed-query'
import { sessionRosterQuery } from '@/domains/sessions/renderer/roster/session-roster-query'
import {
  useRosterWindowCursor,
  useRosterWindowStore,
} from '@/domains/sessions/renderer/roster/use-roster-window-store'
import type { SessionContractError } from '@/domains/sessions/renderer/session-contract-error'
import {
  mergeOptimisticRow,
  readableSessionId,
  useSessionCreationStore,
} from '@/domains/sessions/renderer/session-creation'
import { invalidateSessionRoster } from '@/domains/sessions/renderer/session-queries'
import type { SessionFeed, SessionId } from '@/domains/sessions/renderer/types'
import { useWatchedQueries, useWatchedTopic } from '@/domains/sessions/renderer/use-watched-topic'

// A refresh must refresh only the window this reader has already loaded, never regrow it (#2239),
// and every consumer of the roster must agree on which window that is: the cursor therefore lives in
// a store all of them read, and in the query key, so growing the window is a different cached read
// rather than a refetch of the same one.
function useRosterQuery(enabled: boolean, projectRoot: string | null) {
  const cursor = useRosterWindowCursor(projectRoot)
  const grow = useRosterWindowStore((state) => state.grow)
  const queryClient = useQueryClient()
  const query = useQuery(sessionRosterQuery(enabled, { projectRoot, cursor }))

  // A Session written by a Harness outside Argo appears because the transcript trees are watched. The
  // roster used to notice it only by re-reading every file twice a second, and only while a Session
  // was selected, so a reader just looking at the list saw a stale roster indefinitely.
  useWatchedTopic('sessions', () => {
    if (enabled) void invalidateSessionRoster(queryClient)
  })

  const nextCursor = query.data?.nextCursor ?? null
  return {
    query,
    hasMore: nextCursor !== null,
    // `isPlaceholderData` is true while a larger window is in flight and the previous one is still on
    // screen, which is what the list draws as its loading-more row.
    isFetchingMore: query.isPlaceholderData,
    fetchMore: useCallback(() => {
      if (nextCursor === null) return
      grow(projectRoot, nextCursor)
    }, [grow, nextCursor, projectRoot]),
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
    isFetchingMore: isFetchingMoreSessions,
    fetchMore: fetchMoreSessions,
  } = useRosterQuery(rosterEnabled, projectRoot)
  const feedQuery = sessionFeedQuery(queryClient, selectedFeedId, null)
  const feed = useQuery<SessionFeed | null, SessionContractError>(feedQuery)
  // The open Session's transcript lives under the same watched trees as every other, whether a Harness
  // outside Argo writes it or a Turn Argo drives does.
  useWatchedQueries('sessions', [feedQuery.queryKey])

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
  // A new Codex Session is navigable as soon as its drive channel returns an id, before its
  // first transcript record makes the Session discoverable to the Feed reader. Keep that
  // expected gap loading; the failed Feed query already retries until the record arrives.
  const isReconcilingSelection = pending?.stage === 'reconciling' && pending.id === selectedFeedId
  const feedError = isReconcilingSelection || feed.failureCount <= 1 ? null : feed.error

  return {
    roster: mergedRoster,
    rosterError: roster.error,
    // A poll racing the transcript another live process is actively writing can fail once and
    // recover on the next, whether or not a prior read already landed: the first open of an
    // actively driven Session races the same writer every other poll does (#2053, #2071).
    // `failureCount` is consecutive failed fetches and resets to 0 on the next success.
    feed: feed.data ?? null,
    feedError,
    hasMoreSessions,
    isFetchingMoreSessions,
    fetchMoreSessions,
    reread: () => invalidateSessionRoster(queryClient),
    // Cancel a read that never answers (#2102), because TanStack reuses a pending query without cached data.
    retryFeed: () => void retrySessionFeed(queryClient, feedQuery.queryKey, feed.refetch),
  }
}
