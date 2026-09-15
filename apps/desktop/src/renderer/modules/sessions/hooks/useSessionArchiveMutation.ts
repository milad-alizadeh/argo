import { useMutation, useQueryClient } from '@tanstack/react-query'
import { throwSessionContractError, throwUnexpectedSessionReply } from '../session-contract-error'
import { invalidateSessionRoster } from '../session-queries'
import type { SessionId } from '../types'

export type ArchiveSetOutcome = { applied: SessionId[]; failed: SessionId[] }

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
