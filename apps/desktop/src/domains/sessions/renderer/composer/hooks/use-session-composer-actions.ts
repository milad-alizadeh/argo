import type { QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive'
import { invalidateSessionRoster } from '../../session-queries'
import { codeFrom, type Failure, messageFrom } from '../send'
import type { useSessionMutations } from './use-session-mutations'

export function useInterrupt(
  interrupt: ReturnType<typeof useSessionMutations>['interrupt'],
  sessionId: string | null,
  setFailure: (failure: Failure | null) => void,
) {
  return useCallback(async () => {
    if (sessionId === null) return false
    try {
      await interrupt.mutateAsync(sessionId)
      return true
    } catch (error) {
      setFailure({
        sessionId,
        message: messageFrom(error, 'Argo could not interrupt this Session.'),
        code: codeFrom(error),
      })
      return false
    }
  }, [interrupt, sessionId, setFailure])
}

export function useSteer(
  steer: ReturnType<typeof useSessionMutations>['steer'],
  sessionId: string | null,
  setFailure: (failure: Failure | null) => void,
) {
  return useCallback(
    async (prompt: string, attachments: SessionAttachmentInput[]) => {
      if (sessionId === null) return false
      try {
        await steer.mutateAsync({ prompt, sessionId, attachments })
        setFailure(null)
        return true
      } catch (error) {
        setFailure({
          sessionId,
          message: messageFrom(error, 'Argo could not steer this Session.'),
          code: codeFrom(error),
        })
        return false
      }
    },
    [sessionId, setFailure, steer],
  )
}

export function useCompact(
  compact: ReturnType<typeof useSessionMutations>['compact'],
  sessionId: string | null,
  setFailure: (failure: Failure | null) => void,
) {
  return useCallback(async () => {
    if (sessionId === null) return false
    try {
      await compact.mutateAsync(sessionId)
      setFailure(null)
      return true
    } catch (error) {
      setFailure({
        sessionId,
        message: messageFrom(error, 'Argo could not compact this Session.'),
        code: codeFrom(error),
      })
      return false
    }
  }, [compact, sessionId, setFailure])
}

// Compacting changes the Session's context token count, which the roster reads too.
export function useCompactWithInvalidate(request: {
  compact: ReturnType<typeof useSessionMutations>['compact']
  sessionId: string | null
  setFailure: (failure: Failure | null) => void
  queryClient: QueryClient
}) {
  const compactSession = useCompact(request.compact, request.sessionId, request.setFailure)
  return useCallback(async () => {
    const compacted = await compactSession()
    if (compacted) await invalidateSessionRoster(request.queryClient)
    return compacted
  }, [compactSession, request.queryClient])
}
