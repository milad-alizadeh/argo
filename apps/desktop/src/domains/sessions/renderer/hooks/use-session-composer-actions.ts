import type { QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import type { SessionErrorCode } from '@/domains/sessions/contract/contract'
import type { useSessionMutations } from '@/domains/sessions/renderer/hooks/use-session-mutations'
import { SessionContractError } from '@/domains/sessions/renderer/session-contract-error'
import { invalidateSessionRoster } from '@/domains/sessions/renderer/session-queries'
import type { TurnSetup } from '@/domains/sessions/renderer/turn-setup/turn-setup'

// A failure belongs to the Session it happened on, so selecting another Session does not show it.
export type Failure = { sessionId: string | null; message: string; code: SessionErrorCode | null }

export function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function codeFrom(error: unknown): SessionErrorCode | null {
  return error instanceof SessionContractError ? error.code : null
}

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

export async function sendMessage(
  request: {
    send: ReturnType<typeof useSessionMutations>['send']
    prompt: string
    setup: TurnSetup | null
    attachments: SessionAttachmentInput[]
    sessionId: string
    setFailure: (failure: Failure | null) => void
  },
  afterSend: () => Promise<void>,
) {
  const { send, prompt, setup, attachments, sessionId, setFailure } = request
  try {
    await send.mutateAsync({ prompt, sessionId, setup, attachments })
    setFailure(null)
  } catch (error) {
    setFailure({
      sessionId,
      message: messageFrom(error, 'Argo could not send this message.'),
      code: codeFrom(error),
    })
    return false
  }
  await afterSend()
  return true
}
