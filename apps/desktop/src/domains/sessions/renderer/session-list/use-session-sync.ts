import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { queryClient, type RouterOutputs, trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { invalidateSessionList } from '../session-queries'

type SyncStatus = Extract<RouterOutputs['sessions']['syncStatus'], { type: 'status' }>['status']

export function useSessionSync() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const refresh = useMutation(trpc.sessions.refresh.mutationOptions())
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const previousPhase = useRef<SyncStatus['phase'] | null>(null)
  useEffect(() => {
    const subscription = trpcClient.sessions.syncStatus.subscribe(undefined, {
      onData: (event) => {
        if (event.type === 'committed') {
          void invalidateSessionList(queryClient)
          return
        }
        const earlierPhase = previousPhase.current
        previousPhase.current = event.status.phase
        setStatus(event.status)
        if (earlierPhase === null) return
        if (event.status.phase === 'ready' && earlierPhase !== 'ready' && event.status.skipped > 0)
          add({ title: t('sync.partial', { count: event.status.skipped }), type: 'error' })
        if (event.status.phase === 'failed' && earlierPhase !== 'failed')
          add({
            title: t('sync.failed'),
            description: event.status.failure ?? undefined,
            type: 'error',
          })
      },
    })
    return () => subscription.unsubscribe()
  }, [add, t])
  const refreshing = status?.phase === 'fetching' || status?.phase === 'saving' || refresh.isPending
  return {
    status,
    refreshing,
    refresh: () => {
      if (!refreshing) refresh.mutate()
    },
  }
}
