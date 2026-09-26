import { useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { invalidateSessionList } from '@/domains/sessions/renderer/session-queries'
import { queryClient, trpc, trpcClient } from '@/platform/renderer/trpc-client'

export function useSessionSync() {
  const refresh = useMutation(trpc.sessionRefresh.mutationOptions())
  useEffect(() => {
    const subscription = trpcClient.sessionSyncStatus.subscribe(undefined, {
      onData: () => {
        void invalidateSessionList(queryClient)
      },
    })
    return () => subscription.unsubscribe()
  }, [])
  return {
    refreshing: refresh.isPending,
    refresh: () => refresh.mutate(),
  }
}
