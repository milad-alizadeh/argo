import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { retrySessionFeed, sessionFeedQuery } from './feed/session-feed-query'
import type { SessionContractError } from './session-contract-error'
import { mergeOptimisticRow, readableSessionId, useSessionCreationStore } from './session-creation'
import { reportCodexFailure } from './session-list/codex-failure-notice'
import { sessionRosterQuery } from './session-list/rows/session-roster-query'
import { invalidateSessionRoster } from './session-queries'
import type { SessionFeed, SessionId } from './types'
import { useWatchedQueries, useWatchedTopic } from './use-watched-topic'

function useRosterQuery(enabled: boolean, projectRoot: string | null) {
  const queryClient = useQueryClient()
  const query = useInfiniteQuery(sessionRosterQuery(enabled, { projectRoot }))

  // A Session written by a Harness outside Argo appears because the transcript trees are watched. The
  // roster used to notice it only by re-reading every file twice a second, and only while a Session
  // was selected, so a reader just looking at the list saw a stale roster indefinitely.
  useWatchedTopic('sessions', () => {
    if (enabled) void invalidateSessionRoster(queryClient)
  })

  const lastPage = query.data?.pages.at(-1)
  const roster = useMemo(() => {
    if (lastPage === undefined) return null
    return { ...lastPage, sessions: query.data?.pages.flatMap((page) => page.sessions) ?? [] }
  }, [lastPage, query.data?.pages])
  return {
    query,
    roster,
    hasMore: query.hasNextPage,
    isFetchingMore: query.isFetchingNextPage,
    fetchMore: useCallback(() => {
      if (!query.hasNextPage || query.isFetchingNextPage) return
      void query.fetchNextPage()
    }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]),
  }
}

export function useConsecutiveFeedFailures(
  sessionId: SessionId | null,
  feed: { isSuccess: boolean; isError: boolean; errorUpdatedAt: number },
) {
  const [failedReads, setFailedReads] = useState({ sessionId, lastErrorAt: 0, count: 0 })
  useEffect(() => {
    if (feed.isSuccess || sessionId === null) {
      setFailedReads({ sessionId, lastErrorAt: 0, count: 0 })
      return
    }
    if (!feed.isError) return
    setFailedReads((current) => {
      const count =
        current.sessionId !== sessionId
          ? 1
          : current.count + Number(current.lastErrorAt !== feed.errorUpdatedAt)
      return { sessionId, lastErrorAt: feed.errorUpdatedAt, count }
    })
  }, [feed.errorUpdatedAt, feed.isError, feed.isSuccess, sessionId])
  return failedReads.sessionId === sessionId ? failedReads.count : 0
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
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const selectedFeedId = readableSessionId(selectedSessionId)
  const {
    query: roster,
    roster: rosterPage,
    hasMore: hasMoreSessions,
    isFetchingMore: isFetchingMoreSessions,
    fetchMore: fetchMoreSessions,
  } = useRosterQuery(rosterEnabled, projectRoot)
  const feedQuery = sessionFeedQuery(queryClient, selectedFeedId, null)
  const feed = useQuery<SessionFeed | null, SessionContractError>(feedQuery)
  const failedFeedReads = useConsecutiveFeedFailures(selectedFeedId, feed)
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
  const rosterData = roster.error === null ? rosterPage : null
  const mergedRoster = useMemo(() => {
    if (rosterData === null) return null
    return { ...rosterData, sessions: mergeOptimisticRow(rosterData.sessions, pending) }
  }, [rosterData, pending])

  // A partial Codex failure must leave Claude usable. One toast marks the outage for this app run.
  useEffect(() => {
    reportCodexFailure(
      rosterData?.partialFailures ?? [],
      {
        title: t('sessionList.sourceFailed', { harness: 'Codex' }),
        description: t('sessionList.codexSourceFailedDescription'),
      },
      (notice) => add({ ...notice, type: 'error', priority: 'high' }),
    )
  }, [add, rosterData?.partialFailures, t])

  // The reader reported the real Session for itself: the synthetic row has done its job.
  useEffect(() => {
    if (pending?.stage !== 'reconciling') return
    if (rosterData?.sessions.some((session) => session.id === pending.id) !== true) return
    if (feed.data === undefined || feed.data === null) return
    useSessionCreationStore.getState().confirmed(pending.id)
  }, [feed.data, pending, rosterData])
  // A new Codex Session is navigable as soon as its drive channel returns an id, before its
  // first transcript record makes the Session discoverable to the Feed reader. Keep that
  // expected gap loading; the failed Feed query already retries until the record arrives.
  const isReconcilingSelection = pending?.stage === 'reconciling' && pending.id === selectedFeedId
  const feedError = isReconcilingSelection || failedFeedReads <= 1 ? null : feed.error

  return {
    roster: mergedRoster,
    rosterError: roster.error,
    // A poll racing the transcript another live process is actively writing can fail once and
    // recover on the next, whether or not a prior read already landed: the first open of an
    // actively driven Session races the same writer every other poll does (#2053, #2071).
    // Failed polls are counted across refetches, then reset by a successful read.
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
