import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { retrySessionFeed, sessionFeedQuery } from './feed/session-feed-query'
import type { SessionContractError } from './session-contract-error'
import { sessionListQuery } from './session-list/rows/session-list-query'
import { invalidateSessionList } from './session-queries'
import type { SessionFeed, SessionId } from './types'

function useSessionListQuery(projectId: string | null, enabled: boolean, search: string) {
  const query = useInfiniteQuery(sessionListQuery(projectId, enabled, search))

  const lastPage = query.data?.pages.at(-1)
  const sessionList = useMemo(() => {
    if (lastPage === undefined) return null
    return { ...lastPage, sessions: query.data?.pages.flatMap((page) => page.sessions) ?? [] }
  }, [lastPage, query.data?.pages])
  return {
    query,
    sessionList,
    loadedPages: query.data?.pages.length ?? 0,
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
// A Session that only exists as an optimistic Session row has no backend record to read a feed
// for yet (#2109); the backend is asked only once the id is a real one.
// `sessionListEnabled` lets a caller that only sometimes needs the list (a Ticket's Linked
// Sessions, unread until a Ticket is selected) skip the fetch rather than pull the whole
// list in for a result it may throw away.
export function useSessions({
  selectedSessionId,
  sessionListEnabled = true,
  projectId = null,
  sessionListSearch = '',
}: {
  selectedSessionId: SessionId | null
  sessionListEnabled?: boolean
  projectId?: string | null
  sessionListSearch?: string
}) {
  const queryClient = useQueryClient()
  const selectedFeedId = selectedSessionId
  const {
    query: sessionListQueryResult,
    sessionList: sessionListPage,
    loadedPages: loadedSessionPages,
    hasMore: hasMoreSessions,
    isFetchingMore: isFetchingMoreSessions,
    fetchMore: fetchMoreSessions,
  } = useSessionListQuery(projectId, sessionListEnabled, sessionListSearch)
  const feedQuery = sessionFeedQuery(queryClient, selectedFeedId, null)
  const feed = useQuery<SessionFeed | null, SessionContractError>(feedQuery)
  const failedFeedReads = useConsecutiveFeedFailures(selectedFeedId, feed)
  // An already-settled read has no in-flight abort to notify the main process. Release it here
  // as well, so a Session switch or close drops its Feed rows and measurement state immediately.
  useEffect(() => {
    if (selectedFeedId === null) return
    return () => void window.argo.cancelSessionFeed({ sessionId: selectedFeedId })
  }, [selectedFeedId])

  const sessionList = sessionListQueryResult.error === null ? sessionListPage : null

  const feedError = failedFeedReads <= 1 ? null : feed.error

  return {
    sessionList,
    sessionListError: sessionListQueryResult.error,
    loadedSessionPages,
    // A poll racing the transcript another live process is actively writing can fail once and
    // recover on the next, whether or not a prior read already landed: the first open of an
    // actively driven Session races the same writer every other poll does (#2053, #2071).
    // Failed polls are counted across refetches, then reset by a successful read.
    feed: feed.data ?? null,
    feedError,
    hasMoreSessions,
    isFetchingMoreSessions,
    fetchMoreSessions,
    reread: () => invalidateSessionList(queryClient),
    // Cancel a read that never answers (#2102), because TanStack reuses a pending query without cached data.
    retryFeed: () => void retrySessionFeed(queryClient, feedQuery.queryKey, feed.refetch),
  }
}
