import { skipToken, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyFeedReadingChange,
  type FeedReading,
  feedReadingRows,
} from '@/domains/sessions/api/feed'
import { sessionError } from '@/domains/sessions/api/session-error'
import { reconnectingSubscription } from '@/platform/renderer/reconnecting-subscription'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionFeedReadingQueryKey, sessionPermissionQueryKey } from '../session-queries'
import type { SessionFeed, SessionId } from '../types'
import { useFocusRefresh } from './use-focus-refresh'

const NO_SUBAGENTS: FeedReading['subagents'] = []

// A Feed with no rows has nothing to draw until a read settles it; its Standing says why.
function drawnFeed(
  reading: FeedReading,
  running: boolean,
  loadOlder: (() => void) | null,
): SessionFeed | null {
  const rows = feedReadingRows(reading.entries, { running })
  if (reading.state !== 'ready' && rows.length === 0) return null
  return {
    sessionId: reading.sessionId,
    chainId: reading.chainId,
    // The drawn rows, not the reading, are what a revision stands for: the same reading draws
    // different rows once its activity folds in, so a live draw needs its own revision.
    revision: running ? `${reading.revision}:live` : reading.revision,
    rows: [...rows],
    ...(reading.hasOlder && loadOlder !== null ? { loadOlder } : {}),
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
    const subscription = reconnectingSubscription((lost) =>
      trpcClient.sessionFeed.subscribe(
        { sessionId, subagentId },
        {
          onData(message) {
            if (message.sessionId !== sessionId || message.chainId !== (subagentId ?? sessionId))
              return
            const key = sessionFeedReadingQueryKey(sessionId, subagentId)
            const reading = applyFeedReadingChange(queryClient.getQueryData(key), message)
            // A change against a reading this cache no longer holds needs a whole one again.
            if (reading === null) return subscription.reconnect()
            setLostSessionId(null)
            queryClient.setQueryData(key, reading)
          },
          onError() {
            if (lost()) setLostSessionId(sessionId)
          },
        },
      ),
    )
    reconnect.current = subscription.reconnect
    return () => {
      reconnect.current = null
      subscription.stop()
    }
  }, [sessionId, subagentId])
  return { reconnect, lost: sessionId !== null && lostSessionId === sessionId }
}

// A root Session's or a Subagent's Feed as main reads it. The renderer only draws it; Retry and
// focus start a real read, or a reconnection when no reader answers.
export function useFeedReading(
  sessionId: SessionId | null,
  subagentId: string | null = null,
  // The Session's own liveness: the Feed folds its current activity in only while the Turn runs.
  running = false,
) {
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
  const loadOlder = useMemo(() => {
    if (sessionId === null) return null
    return () => void trpcClient.sessionFeedOlder.mutate({ sessionId, subagentId }).catch(() => {})
  }, [sessionId, subagentId])
  const reading = useObservedFeedReading(sessionId, subagentId)
  const feed = useMemo(
    () => (reading === null ? null : drawnFeed(reading, running, loadOlder)),
    [reading, running, loadOlder],
  )
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
