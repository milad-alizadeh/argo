import { useEffect, useMemo, useState } from 'react'
import type { SessionFeed, SessionFeedPage, SessionId } from '../types'
import { projectLiveFeedRows } from './model/live-feed-rows'
import { useFeedHistory } from './use-feed-history'
import { useLiveFeedEvents } from './use-live-feed-events'

function displayedFeed({
  selectedSessionId,
  subagentId,
  reading,
  live,
}: {
  selectedSessionId: SessionId | null
  subagentId: string | null
  reading: SessionFeedPage | SessionFeed | null | undefined
  live: ReturnType<typeof useLiveFeedEvents>
}): SessionFeed | null {
  if (selectedSessionId === null) return null
  const current = reading?.sessionId === selectedSessionId ? reading : null
  const events = live?.events ?? []
  if (current === null && events.length === 0) return null
  if (current !== null && current.content === undefined) return current as SessionFeed
  const rows = projectLiveFeedRows(current?.content ?? [], events)
  const base = current ?? {
    version: 1,
    type: 'session.feed.read',
    requestId: selectedSessionId,
    sessionId: selectedSessionId,
    chainId: subagentId ?? selectedSessionId,
    revision: 'live',
    olderCursor: null,
    content: [],
  }
  return {
    ...base,
    revision: `${base.revision}:${events.at(-1)?.sequence ?? 0}`,
    rows,
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

export function useSessionFeed(
  selectedSessionId: SessionId | null,
  subagentId: string | null = null,
) {
  const live = useLiveFeedEvents(selectedSessionId, subagentId)
  const history = useFeedHistory(selectedSessionId, subagentId, live?.ready ?? false)
  const displayed = useMemo(
    () => displayedFeed({ selectedSessionId, subagentId, reading: history.reading, live }),
    [history.reading, live, selectedSessionId, subagentId],
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
