import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { SessionId } from '../../types'

type ArchiveSetOutcome = { applied: SessionId[]; failed: SessionId[] }

// A short-lived Undo (#2194 follow-up): its close is what makes an id "gone" from this
// component's perspective, and the manager fires that close for either reason interchangeably
// — a manual dismiss and the timeout both count as "the archive stands."
const UNDO_TOAST_TIMEOUT_MS = 8000

// One Session update for every id, in both directions (#2194): `archived: true` is the bulk action
// and `archived: false` its Undo. An id main did not update comes back in `failed`.
function useSessionArchiveMutation() {
  return useMutation<ArchiveSetOutcome, Error, { sessionIds: SessionId[]; archived: boolean }>({
    mutationFn: async ({ sessionIds, archived }) => {
      const rows = await trpcClient.sessionUpdate.mutate({ sessionIds, archived }).catch(() => [])
      const applied = new Set(rows.map((row) => row.id))
      return {
        applied: sessionIds.filter((sessionId) => applied.has(sessionId)),
        failed: sessionIds.filter((sessionId) => !applied.has(sessionId)),
      }
    },
  })
}

// Restoring calls the same archive mutation with `archived: false` on the ids just applied, so
// this is what wires the bulk action to its own Undo, without either living inside a render body.
export function useArchiveSelected() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const { mutate } = useSessionArchiveMutation()
  // Stable, because a Session list row's menu reaches this through a memoized row.
  return useCallback(
    (sessionIds: SessionId[]) => {
      mutate(
        { archived: true, sessionIds },
        {
          onSuccess: ({ applied, failed }) => {
            if (applied.length > 0) {
              add({
                title: t('bulkSelect.archived', { count: applied.length }),
                type: 'success',
                timeout: UNDO_TOAST_TIMEOUT_MS,
                actionProps: {
                  children: t('bulkSelect.undo'),
                  onClick: () => {
                    mutate(
                      { archived: false, sessionIds: applied },
                      {
                        onSuccess: ({ applied: restored }) => {
                          if (restored.length > 0) {
                            add({
                              title: t('bulkSelect.restored', { count: restored.length }),
                              type: 'success',
                              timeout: UNDO_TOAST_TIMEOUT_MS,
                            })
                          }
                        },
                      },
                    )
                  },
                },
              })
            }
            if (failed.length > 0) {
              add({
                title:
                  applied.length > 0 ? t('bulkSelect.partialFailure') : t('bulkSelect.failure'),
                type: 'error',
                timeout: UNDO_TOAST_TIMEOUT_MS,
              })
            }
          },
        },
      )
    },
    [add, mutate, t],
  )
}
