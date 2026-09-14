import { useCallback } from 'react'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionCli } from '../harness/harnesses'
import { SessionContractError } from '../session-contract-error'
import { useSessionCreationStore } from '../state/useSessionCreationStore'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { ComposerIdentity } from './composerIdentity'
import type { useSessionMutations } from './useSessionMutations'

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

export async function sendMessage(
  request: {
    send: ReturnType<typeof useSessionMutations>['send']
    prompt: string
    setup: TurnSetup | null
    sessionId: string
    setFailure: (failure: Failure | null) => void
  },
  afterSend: () => Promise<void>,
) {
  const { send, prompt, setup, sessionId, setFailure } = request
  try {
    await send.mutateAsync({ prompt, sessionId, setup })
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

export async function startNewSession(
  request: {
    cli: SessionCli
    cockpit: Cockpit
    identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>
    prompt: string
    setup: TurnSetup | null
    start: ReturnType<typeof useSessionMutations>['start']
    setFailure: (failure: Failure | null) => void
  },
  afterStart: (sessionId: string) => Promise<void>,
  onStarted: (sessionId: string) => void,
  onFailed: () => void,
) {
  const { cli, cockpit, identity, prompt, setup, start, setFailure } = request
  if (cockpit.project === null) {
    setFailure({
      sessionId: null,
      message: 'Select a Project before starting a Session.',
      code: null,
    })
    return false
  }
  const creation = useSessionCreationStore.getState()
  // The "+" click already began this row (`identity.kind === 'pending'`); a Send from a bare
  // composer with no prior "+" begins one here instead. Either way, one draft row exists.
  const pending =
    identity.kind === 'pending' ? creation.pending : creation.begin(cli, cockpit.project.path)
  if (pending === null || pending.stage !== 'draft') return false
  // A rapid second Enter/`+` finds the row already submitting and no-ops (#2109): the observable
  // contract is one user action produces at most one new Session, not which mechanism enforces it.
  if (!creation.startSubmission(pending.id)) return false
  try {
    const reply = await start.mutateAsync({ cli, cwd: cockpit.project.path, prompt, setup })
    creation.resolved(pending.id, reply.sessionId)
    setFailure(null)
    await afterStart(reply.sessionId)
    onStarted(reply.sessionId)
    return true
  } catch (error) {
    creation.failed(pending.id)
    setFailure({
      sessionId: null,
      message: messageFrom(error, 'Argo could not start this Session.'),
      code: codeFrom(error),
    })
    onFailed()
    return false
  }
}
