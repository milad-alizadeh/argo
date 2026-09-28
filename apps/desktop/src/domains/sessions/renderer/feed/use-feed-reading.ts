import { skipToken, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FeedReading } from '@/domains/sessions/api/feed/feed-reading'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionFeedReadingQueryKey, sessionPermissionQueryKey } from '../session-queries'
import type { SessionFeed, SessionId } from '../types'
import { useFocusRefresh } from './use-focus-refresh'

// A Feed with no rows has nothing to draw until a read settles it; its Standing says why.
function drawnFeed(reading: FeedReading): SessionFeed | null {
  const rows = reading.entries.flatMap(({ row }) => (row.shape === 'activity' ? [] : [row]))
  if (reading.state !== 'ready' && rows.length === 0) return null
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: reading.revision,
    sessionId: reading.sessionId,
    chainId: reading.chainId,
    revision: reading.revision,
    rows,
  }
}

// The latest reading main published for this Session; structural sharing keeps each unchanged
// row the same object, so a mounted row that did not change draws nothing.
export function useObservedFeedReading(sessionId: SessionId | null): FeedReading | null {
  return (
    useQuery<FeedReading>({
      queryKey: sessionFeedReadingQueryKey(sessionId),
      queryFn: skipToken,
      staleTime: Number.POSITIVE_INFINITY,
      // A Feed belongs to its open reader; a reopened Session waits for main's next reading.
      gcTime: 0,
    }).data ?? null
  )
}

function refreshFeed(sessionId: SessionId) {
  void trpcClient.sessionFeedRefresh.mutate({ sessionId }).catch(() => {})
}

// A new or settled Permission request is read again through its own query.
function usePermissionRequest(sessionId: SessionId | null, requestId: string | null) {
  const seen = useRef<string | null>(null)
  useEffect(() => {
    if (sessionId === null || seen.current === requestId) return
    seen.current = requestId
    void queryClient.invalidateQueries({ queryKey: sessionPermissionQueryKey(sessionId) })
  }, [sessionId, requestId])
}

// The root Session's Feed as main reads it. The renderer only draws it; a lost subscription
// reconnects, and the reader it reaches reads history again.
export function useFeedReading(sessionId: SessionId | null) {
  // Set while the subscription is lost, so Retry reconnects instead of waiting out the timer.
  const reconnectNow = useRef<(() => void) | null>(null)
  // Focus reads vendor history again, for a Session with no live channel.
  useFocusRefresh(
    useMemo(() => (sessionId === null ? null : () => refreshFeed(sessionId)), [sessionId]),
  )
  useEffect(() => {
    if (sessionId === null) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let subscription: { unsubscribe: () => void } | null = null
    const connect = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      reconnectNow.current = null
      subscription?.unsubscribe()
      subscription = trpcClient.sessionFeed.subscribe(
        { sessionId },
        {
          onData(reading) {
            if (reading.sessionId === sessionId)
              queryClient.setQueryData(sessionFeedReadingQueryKey(sessionId), reading)
          },
          onError() {
            if (stopped) return
            reconnectNow.current = connect
            timer = setTimeout(connect, 1000)
          },
        },
      )
    }
    connect()
    return () => {
      stopped = true
      reconnectNow.current = null
      subscription?.unsubscribe()
      if (timer !== null) clearTimeout(timer)
    }
  }, [sessionId])
  const reading = useObservedFeedReading(sessionId)
  const feed = useMemo(() => (reading === null ? null : drawnFeed(reading)), [reading])
  usePermissionRequest(sessionId, reading?.pendingPermissionId ?? null)
  const retryFeed = useCallback(() => {
    if (sessionId === null) return
    if (reconnectNow.current === null) refreshFeed(sessionId)
    else reconnectNow.current()
  }, [sessionId])
  return {
    feed,
    feedError: reading?.error ?? null,
    liveStatus: reading?.liveStatus ?? null,
    pendingQuestionId: reading?.pendingQuestionId ?? null,
    retryFeed,
  }
}
