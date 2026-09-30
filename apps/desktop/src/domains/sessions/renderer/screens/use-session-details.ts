import { skipToken, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { reconnectingSubscription } from '@/platform/renderer/reconnecting-subscription'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { sessionDetailsQueryKey } from '../session-queries'
import type { SessionDetailsUpdate, SessionId } from '../types'

// A Session's details by ID, independent of the roster; each update lands under the Session it names.
// A revisit draws cached details until main's first reply, so the composer stays steady (#2836).
export function useSessionDetails(sessionId: SessionId | null) {
  useEffect(() => {
    if (sessionId === null) return
    const subscription = reconnectingSubscription((lost) =>
      trpcClient.sessionDetails.subscribe(
        { sessionId },
        {
          onData(update) {
            queryClient.setQueryData(sessionDetailsQueryKey(update.sessionId), update)
          },
          onError: lost,
        },
      ),
    )
    return subscription.stop
  }, [sessionId])
  const update = useQuery<SessionDetailsUpdate>({
    queryKey: sessionDetailsQueryKey(sessionId),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
  }).data
  return {
    session: update?.details ?? null,
    loaded: sessionId !== null && update !== undefined,
  }
}
