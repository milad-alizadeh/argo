import { useEffect, useMemo, useState } from 'react'
import type { SessionFeed, SessionId } from '../types'
import { projectLiveFeedRows } from './model/live-feed-rows'
import { useFeedHistory } from './use-feed-history'
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
  const live = useLiveFeedEvents(selectedSessionId)
  const history = useFeedHistory(selectedSessionId, null, live?.ready ?? false)
  const displayed = useMemo(
    () => displayedFeed(selectedSessionId, history.reading, live),
    [history.reading, live, selectedSessionId],
  )
  return {
    feed: displayed,
    feedError: history.error,
    retryFeed: history.retry,
    loadOlder: history.loadOlder,
    hasOlder: history.hasOlder,
    loadingOlder: history.loadingOlder,
    olderError: history.olderError,
  }
}
