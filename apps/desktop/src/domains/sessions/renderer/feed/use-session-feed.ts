import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { SessionContractError } from '../session-contract-error'
import type { SessionFeed, SessionId } from '../types'
import { retrySessionFeed, sessionFeedQuery } from './session-feed-query'

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

export function useSessionFeed(selectedSessionId: SessionId | null) {
  const queryClient = useQueryClient()
  const feedQuery = sessionFeedQuery(queryClient, selectedSessionId, null)
  const feed = useQuery<SessionFeed | null, SessionContractError>(feedQuery)
  const failedFeedReads = useConsecutiveFeedFailures(selectedSessionId, feed)
  useEffect(() => {
    if (selectedSessionId === null) return
    return () => void window.argo.cancelSessionFeed({ sessionId: selectedSessionId })
  }, [selectedSessionId])
  return {
    feed: feed.data ?? null,
    feedError: failedFeedReads <= 1 ? null : feed.error,
    retryFeed: () => void retrySessionFeed(queryClient, feedQuery.queryKey, feed.refetch),
  }
}
