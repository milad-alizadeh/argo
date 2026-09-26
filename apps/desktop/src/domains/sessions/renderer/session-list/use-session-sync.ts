import { useEffect } from 'react'
import { invalidateSessionList } from '@/domains/sessions/renderer/session-queries'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'

export function useSessionSync(): void {
  useEffect(() => {
    const subscription = trpcClient.sessions.syncStatus.subscribe(undefined, {
      onData: () => {
        void invalidateSessionList(queryClient)
      },
    })
    return () => subscription.unsubscribe()
  }, [])
}
