import { useEffect } from 'react'
import { queryClient, trpc, trpcClient } from '@/platform/renderer/trpc-client'

// The only renderer code that changes Session data in the query cache: main's change signal.
export function SessionChanges() {
  useEffect(() => {
    const subscription = trpcClient.sessionListChanged.subscribe(undefined, {
      onData: ({ sessionIds }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.sessionList.pathKey() })
        for (const sessionId of sessionIds)
          void queryClient.invalidateQueries({
            queryKey: trpc.sessionDetails.queryKey({ sessionId }),
          })
      },
    })
    return () => subscription.unsubscribe()
  }, [])
  return null
}
