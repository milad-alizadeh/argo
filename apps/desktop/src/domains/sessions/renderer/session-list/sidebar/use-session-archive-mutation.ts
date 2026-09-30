import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionId } from '../../types'

// A short-lived Undo: a manual dismiss and the timeout both leave the archive standing.
const UNDO_TOAST_TIMEOUT_MS = 8000

// One Session update for every id (#2194): `archived: true` is the bulk action, `false` its Undo.
export function useArchiveSelected() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()

  // The ids main updated, or null when the update failed and its reason was shown.
  const update = async (sessionIds: SessionId[], archived: boolean) => {
    try {
      const updated = await trpcClient.sessionUpdate.mutate({ sessionIds, archived })
      return sessionIds.filter((sessionId) => updated.sessionIds.includes(sessionId))
    } catch (error) {
      add({
        title: t('bulkSelect.failure'),
        description: error instanceof Error ? error.message : undefined,
        type: 'error',
        timeout: UNDO_TOAST_TIMEOUT_MS,
      })
      return null
    }
  }

  const restore = async (sessionIds: SessionId[]) => {
    const restored = await update(sessionIds, false)
    if (restored === null || restored.length === 0) return
    add({
      title: t('bulkSelect.restored', { count: restored.length }),
      type: 'success',
      timeout: UNDO_TOAST_TIMEOUT_MS,
    })
  }

  return async (sessionIds: SessionId[]) => {
    const applied = await update(sessionIds, true)
    if (applied === null) return
    if (applied.length > 0)
      add({
        title: t('bulkSelect.archived', { count: applied.length }),
        type: 'success',
        timeout: UNDO_TOAST_TIMEOUT_MS,
        actionProps: { children: t('bulkSelect.undo'), onClick: () => void restore(applied) },
      })
    if (applied.length < sessionIds.length)
      add({
        title: applied.length > 0 ? t('bulkSelect.partialFailure') : t('bulkSelect.failure'),
        type: 'error',
        timeout: UNDO_TOAST_TIMEOUT_MS,
      })
  }
}
