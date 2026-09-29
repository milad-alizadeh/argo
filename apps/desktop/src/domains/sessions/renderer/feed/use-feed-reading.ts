import { skipToken, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedReading } from '@/domains/sessions/api/feed/feed-reading'
import { sessionError } from '@/domains/sessions/api/session-error'
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

// A new or settled Permission request is read again through its own query.
function usePermissionRequest(sessionId: SessionId | null, requestId: string | null) {
  const seen = useRef<string | null>(null)
  useEffect(() => {
    if (sessionId === null || seen.current === requestId) return
    seen.current = requestId
    void queryClient.invalidateQueries({ queryKey: sessionPermissionQueryKey(sessionId) })
  }, [sessionId, requestId])
}

// The root Session's subscription: each reading lands in the query cache, and a lost one
// reconnects after a second or at once through `reconnect`.
function useFeedSubscription(sessionId: SessionId | null) {
  const reconnect = useRef<(() => void) | null>(null)
  const [lostSessionId, setLostSessionId] = useState<SessionId | null>(null)
  useEffect(() => {
    if (sessionId === null) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let subscription: { unsubscribe: () => void } | null = null
    const connect = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      subscription?.unsubscribe()
      subscription = trpcClient.sessionFeed.subscribe(
        { sessionId },
        {
          onData(reading) {
            if (reading.sessionId !== sessionId) return
            setLostSessionId(null)
            queryClient.setQueryData(sessionFeedReadingQueryKey(sessionId), reading)
          },
          onError() {
            if (stopped) return
            setLostSessionId(sessionId)
            timer = setTimeout(connect, 1000)
          },
        },
      )
    }
    reconnect.current = connect
    connect()
    return () => {
      stopped = true
      reconnect.current = null
      subscription?.unsubscribe()
      if (timer !== null) clearTimeout(timer)
    }
  }, [sessionId])
  return { reconnect, lost: sessionId !== null && lostSessionId === sessionId }
}

// The root Session's Feed as main reads it. The renderer only draws it; Retry and focus start a
// real read, or a reconnection when no reader answers.
export function useFeedReading(sessionId: SessionId | null) {
  const { reconnect, lost } = useFeedSubscription(sessionId)
  const refresh = useMemo(() => {
    if (sessionId === null) return null
    return () => {
      if (lost) return reconnect.current?.()
      void trpcClient.sessionFeedRefresh.mutate({ sessionId }).then(
        ({ accepted }) => {
          if (!accepted) reconnect.current?.()
        },
        () => reconnect.current?.(),
      )
    }
  }, [lost, reconnect, sessionId])
  // Focus reads vendor history again, for a Session with no live channel.
  useFocusRefresh(refresh)
  const reading = useObservedFeedReading(sessionId)
  const feed = useMemo(() => (reading === null ? null : drawnFeed(reading)), [reading])
  usePermissionRequest(sessionId, reading?.pendingPermissionId ?? null)
  const retryFeed = useCallback(() => refresh?.(), [refresh])
  return {
    feed,
    feedError: lost ? sessionError('connection-lost', null) : (reading?.error ?? null),
    liveStatus: reading?.liveStatus ?? null,
    pendingQuestionId: reading?.pendingQuestionId ?? null,
    retryFeed,
  }
}
