import { useCallback } from 'react'

import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionCli } from '../harness/harnesses'
import { SessionContractError } from '../session-contract-error'
import type { useClaudeSessionMutations } from './useClaudeSessionMutations'

type Failure = { sessionId: string | null; message: string; code: SessionErrorCode | null }

export function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function codeFrom(error: unknown): SessionErrorCode | null {
  return error instanceof SessionContractError ? error.code : null
}

export function useCompact({
  compact,
  cli,
  sessionId,
  setFailure,
}: {
  compact: ReturnType<typeof useClaudeSessionMutations>['compact']
  cli: SessionCli
  sessionId: string | null
  setFailure: (failure: Failure | null) => void
}) {
  return useCallback(async () => {
    if (cli !== 'claude' || sessionId === null) return false
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
  }, [cli, compact, sessionId, setFailure])
}

export function useInterrupt({
  interrupt,
  sessionId,
  setFailure,
}: {
  interrupt: { mutateAsync: (sessionId: string) => Promise<void> }
  sessionId: string | null
  setFailure: (failure: Failure | null) => void
}) {
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
