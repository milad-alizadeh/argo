import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { trpc } from '@/platform/renderer/trpc-client'
import type { Session } from '../types'

// Tells the person a Session's worktree folder was gone, so it now works in the main checkout.
export function useTellWorktreeGone() {
  const { add } = useToastManager()
  const { t } = useTranslation('sessions')
  return useCallback(
    (path: string) => add({ title: t('composer.worktreeGone', { path }), type: 'info' }),
    [add, t],
  )
}

// Opening a Session in a worktree asks main to leave the folder if it is gone, before any Send.
export function useLeaveGoneWorktree(session: Pick<Session, 'id' | 'worktree'> | null) {
  const tell = useTellWorktreeGone()
  const { mutateAsync: leave } = useMutation(trpc.sessionLeaveGoneWorktree.mutationOptions())
  const sessionId = session?.id ?? null
  const path = session?.worktree?.path ?? null
  useEffect(() => {
    if (sessionId === null || path === null) return
    // A failed check changes nothing; the next Send checks the folder again.
    void leave({ sessionId }).then(
      ({ worktreeGone }) => worktreeGone !== null && tell(worktreeGone),
      () => undefined,
    )
  }, [leave, path, sessionId, tell])
}
