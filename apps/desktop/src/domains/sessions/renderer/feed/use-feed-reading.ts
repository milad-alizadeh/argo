import { skipToken, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedReading } from '@/domains/sessions/api/feed/feed-reading'
import { feedEntryRows } from '@/domains/sessions/api/feed/feed-row-entries'
import { sessionError } from '@/domains/sessions/api/session-error'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionFeedReadingQueryKey, sessionPermissionQueryKey } from '../session-queries'
import type { SessionFeed, SessionId } from '../types'
import { useFocusRefresh } from './use-focus-refresh'

const NO_SUBAGENTS: FeedReading['subagents'] = []

// A Feed with no rows has nothing to draw until a read settles it; its Standing says why.
function drawnFeed(reading: FeedReading): SessionFeed | null {
  const rows = feedEntryRows(reading.entries)
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

// The latest reading main published for this chain; structural sharing keeps each unchanged
// row the same object, so a mounted row that did not change draws nothing.
export function useObservedFeedReading(
  sessionId: SessionId | null,
  subagentId: string | null = null,
): FeedReading | null {
  return (
    useQuery<FeedReading>({
      queryKey: sessionFeedReadingQueryKey(sessionId, subagentId),
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

// One chain's subscription: each reading lands in the query cache, and a lost one reconnects
// after a second or at once through `reconnect`.
function useFeedSubscription(sessionId: SessionId | null, subagentId: string | null) {
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
        { sessionId, subagentId },
        {
          onData(reading) {
            if (reading.sessionId !== sessionId || reading.chainId !== (subagentId ?? sessionId))
              return
            setLostSessionId(null)
            queryClient.setQueryData(sessionFeedReadingQueryKey(sessionId, subagentId), reading)
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
  }, [sessionId, subagentId])
  return { reconnect, lost: sessionId !== null && lostSessionId === sessionId }
}

// A root Session's or a Subagent's Feed as main reads it. The renderer only draws it; Retry and
// focus start a real read, or a reconnection when no reader answers.
export function useFeedReading(sessionId: SessionId | null, subagentId: string | null = null) {
  const { reconnect, lost } = useFeedSubscription(sessionId, subagentId)
  const refresh = useMemo(() => {
    if (sessionId === null) return null
    return () => {
      if (lost) return reconnect.current?.()
      void trpcClient.sessionFeedRefresh.mutate({ sessionId, subagentId }).then(
        ({ accepted }) => {
          if (!accepted) reconnect.current?.()
        },
        () => reconnect.current?.(),
      )
    }
  }, [lost, reconnect, sessionId, subagentId])
  // Focus reads vendor history again, for a Session with no live channel.
  useFocusRefresh(refresh)
  const reading = useObservedFeedReading(sessionId, subagentId)
  const feed = useMemo(() => (reading === null ? null : drawnFeed(reading)), [reading])
  usePermissionRequest(subagentId === null ? sessionId : null, reading?.pendingPermissionId ?? null)
  const retryFeed = useCallback(() => refresh?.(), [refresh])
  return {
    feed,
    feedError: lost ? sessionError('connection-lost', null) : (reading?.error ?? null),
    liveStatus: reading?.liveStatus ?? null,
    pendingQuestionId: reading?.pendingQuestionId ?? null,
    subagents: reading?.subagents ?? NO_SUBAGENTS,
    retryFeed,
  }
}
