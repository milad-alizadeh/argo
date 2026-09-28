import { useEffect } from 'react'
import { queryClient, trpcClient } from '@/platform/renderer/trpc-client'
import { invalidateSessionList } from '../session-queries'

// The main process announces each live status change, so the roster re-reads without polling.
export function useSessionStatusChanges() {
  useEffect(() => {
    const subscription = trpcClient.sessionStatusChanges.subscribe(undefined, {
      onData: () => void invalidateSessionList(queryClient),
    })
    return () => subscription.unsubscribe()
  }, [])
}
