import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import type { SessionContractError } from '../session-contract-error'
import type { SessionFeed, SessionId } from '../types'
import { projectLiveFeedRows } from './model/live-feed-rows'
import { retrySessionFeed, sessionFeedQuery } from './session-feed-query'
import { useLiveFeedEvents } from './use-live-feed-events'

function displayedFeed(
  selectedSessionId: SessionId | null,
  reading: SessionFeed | null | undefined,
  live: ReturnType<typeof useLiveFeedEvents>,
): SessionFeed | null {
  if (selectedSessionId === null) return null
  const current = reading?.sessionId === selectedSessionId ? reading : null
  const events = live?.events ?? []
  if (current === null && events.length === 0) return null
  if (current !== null && current.content === undefined && events.length === 0) return current
  const rows = projectLiveFeedRows(current?.content ?? [], events)
  const base: SessionFeed = current ?? {
    version: 1,
    type: 'session.feed.read',
    requestId: selectedSessionId,
    sessionId: selectedSessionId,
    chainId: selectedSessionId,
    revision: 'live',
    rows: [],
  }
  return {
    ...base,
    revision: `${base.revision}:${events.at(-1)?.sequence ?? 0}`,
    rows: base.content === undefined ? [...base.rows, ...rows] : rows,
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

export function useSessionFeed(selectedSessionId: SessionId | null) {
  const queryClient = useQueryClient()
  const live = useLiveFeedEvents(selectedSessionId)
  const feedQuery = sessionFeedQuery(selectedSessionId, null, live?.hasChannel ?? false)
  const feed = useQuery<SessionFeed | null, SessionContractError>(feedQuery)
  const failedFeedReads = useConsecutiveFeedFailures(selectedSessionId, feed)
  const displayed = useMemo(
    () => displayedFeed(selectedSessionId, feed.data, live),
    [feed.data, live, selectedSessionId],
  )
  return {
    feed: displayed,
    feedError: failedFeedReads <= 1 ? null : feed.error,
    retryFeed: () => void retrySessionFeed(queryClient, feedQuery.queryKey, feed.refetch),
  }
}
