import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { reconnectingSubscription } from '@/platform/renderer/reconnecting-subscription'
import { type RouterOutputs, trpc, trpcClient } from '@/platform/renderer/trpc-client'

export type SessionSyncStatus = RouterOutputs['sessionSyncStatus']['status']

export function useSessionSync() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const refresh = useMutation(trpc.sessionRefresh.mutationOptions())
  const [status, setStatus] = useState<SessionSyncStatus | null>(null)
  const previousPhase = useRef<SessionSyncStatus['phase'] | null>(null)
  useEffect(() => {
    const subscription = reconnectingSubscription((lost) =>
      trpcClient.sessionSyncStatus.subscribe(undefined, {
        onError: () => void lost(),
        onData: (event) => {
          const earlierPhase = previousPhase.current
          previousPhase.current = event.status.phase
          setStatus(event.status)
          if (earlierPhase === null) return
          if (
            event.status.phase === 'ready' &&
            earlierPhase !== 'ready' &&
            event.status.skipped > 0
          )
            add({ title: t('sync.partial', { count: event.status.skipped }), type: 'error' })
          if (event.status.phase === 'failed' && earlierPhase !== 'failed')
            add({
              title: t('sync.failed'),
              description: event.status.failure ?? undefined,
              type: 'error',
            })
        },
      }),
    )
    return () => subscription.stop()
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
