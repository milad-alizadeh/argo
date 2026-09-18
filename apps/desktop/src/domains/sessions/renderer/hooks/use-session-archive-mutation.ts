import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/renderer/components/ui/toast'
import { throwSessionContractError, throwUnexpectedSessionReply } from '../session-contract-error'
import { invalidateSessionRoster } from '../session-queries'
import type { SessionId } from '../types'

export type ArchiveSetOutcome = { applied: SessionId[]; failed: SessionId[] }

// A short-lived Undo (#2194 follow-up): its close is what makes an id "gone" from this
// component's perspective, and the manager fires that close for either reason interchangeably
// — a manual dismiss and the timeout both count as "the archive stands."
const UNDO_TOAST_TIMEOUT_MS = 8000

// One mutation for both directions (#2194): `archived: true` is the bulk action, `archived: false`
// is what a short-lived Undo calls, on the same ids. Ids the store had no writable row for come
// back in `failed` rather than throwing, so one unwritable Session never sinks the rest of a batch.
export function useSessionArchiveMutation() {
  const queryClient = useQueryClient()
  return useMutation<ArchiveSetOutcome, Error, { sessionIds: SessionId[]; archived: boolean }>({
    mutationFn: async ({ sessionIds, archived }) => {
      const reply = await window.argo.setSessionsArchived({ sessionIds, archived })
      switch (reply.type) {
        case 'session.archive.applied':
          return { applied: reply.applied, failed: reply.failed }
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
    onSuccess: () => {
      invalidateSessionRoster(queryClient)
      queryClient.invalidateQueries({ queryKey: ['sessions', 'archive'] })
    },
  })
}

// Restoring calls the same archive mutation with `archived: false` on the ids just applied, so
// this is what wires the bulk action to its own Undo, without either living inside a render body.
export function useArchiveSelected() {
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const { mutate } = useSessionArchiveMutation()
  // Stable, because a roster row's menu reaches this through a memoized row.
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
