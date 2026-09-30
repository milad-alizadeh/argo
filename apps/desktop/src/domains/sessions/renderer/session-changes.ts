import { useEffect } from 'react'
import { reconnectingSubscription } from '@/platform/renderer/reconnecting-subscription'
import { queryClient, trpc, trpcClient } from '@/platform/renderer/trpc-client'

// Invalidates Session reads; no id means every read, for changes missed while the signal was lost.
function invalidateSessions(sessionIds: readonly string[] | null) {
  void queryClient.invalidateQueries({ queryKey: trpc.sessionList.pathKey() })
  if (sessionIds === null) {
    void queryClient.invalidateQueries({ queryKey: trpc.sessionDetails.pathKey() })
    return
  }
  for (const sessionId of sessionIds)
    void queryClient.invalidateQueries({ queryKey: trpc.sessionDetails.queryKey({ sessionId }) })
}

// The only renderer code that changes Session data in the query cache: main's change signal.
export function SessionChanges() {
  useEffect(() => {
    let reopened = false
    const subscription = reconnectingSubscription((lost) => {
      if (reopened) invalidateSessions(null)
      reopened = true
      return trpcClient.sessionListChanged.subscribe(undefined, {
        onData: ({ sessionIds }) => invalidateSessions(sessionIds),
        onError: () => void lost(),
      })
    })
    return () => subscription.stop()
  }, [])
  return null
}
