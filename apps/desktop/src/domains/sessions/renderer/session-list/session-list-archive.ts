import type { TFunction } from 'i18next'
import type { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionId } from '../types'

type Toasts = { add: ReturnType<typeof useToastManager>['add']; t: TFunction<'sessions'> }

// A short-lived Undo: a manual dismiss and the timeout both leave the archive standing.
const UNDO_TOAST_TIMEOUT_MS = 8000

// The ids main updated (#2194), or null when the update failed and its reason was shown.
async function updateArchived(toasts: Toasts, sessionIds: SessionId[], archived: boolean) {
  try {
    return (await trpcClient.sessionUpdate.mutate({ sessionIds, archived })).sessionIds
  } catch (error) {
    toasts.add({
      title: toasts.t('bulkSelect.failure'),
      description: error instanceof Error ? error.message : undefined,
      type: 'error',
      timeout: UNDO_TOAST_TIMEOUT_MS,
    })
    return null
  }
}

async function restoreSessions(toasts: Toasts, sessionIds: SessionId[]) {
  const restored = await updateArchived(toasts, sessionIds, false)
  if (restored === null || restored.length === 0) return
  toasts.add({
    title: toasts.t('bulkSelect.restored', { count: restored.length }),
    type: 'success',
    timeout: UNDO_TOAST_TIMEOUT_MS,
  })
}

export async function archiveSessions(toasts: Toasts, sessionIds: SessionId[]) {
  const applied = await updateArchived(toasts, sessionIds, true)
  if (applied === null) return
  const { add, t } = toasts
  if (applied.length > 0)
    add({
      title: t('bulkSelect.archived', { count: applied.length }),
      type: 'success',
      timeout: UNDO_TOAST_TIMEOUT_MS,
      actionProps: {
        children: t('bulkSelect.undo'),
        onClick: () => void restoreSessions(toasts, applied),
      },
    })
  if (applied.length < sessionIds.length)
    add({
      title: applied.length > 0 ? t('bulkSelect.partialFailure') : t('bulkSelect.failure'),
      type: 'error',
      timeout: UNDO_TOAST_TIMEOUT_MS,
    })
}
