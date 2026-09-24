import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'

export function useArchiveAction(clearSelection: () => void) {
  const queryClient = useQueryClient()
  const { add } = useToastManager()
  const { t } = useTranslation('sessions')
  return async (sessionIds: string[], archived: boolean) => {
    try {
      await trpcClient.sessions.setArchived.mutate({ argoIds: sessionIds, archived })
      clearSelection()
      await queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() })
    } catch (reason) {
      add({
        title: t('bulkSelect.failure'),
        description: reason instanceof Error ? reason.message : undefined,
        type: 'error',
      })
    }
  }
}
