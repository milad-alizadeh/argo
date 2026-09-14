import { useCallback } from 'react'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionCli } from '../harness/harnesses'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { useSessionMutations } from './useSessionMutations'

// A failure belongs to the Session it happened on, so selecting another Session does not show it.
export type Failure = { sessionId: string | null; message: string }

export function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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
      })
      return false
    }
  }, [interrupt, sessionId, setFailure])
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
    setFailure({ sessionId, message: messageFrom(error, 'Argo could not send this message.') })
    return false
  }
  await afterSend()
  return true
}

export async function startNewSession(
  request: {
    cli: SessionCli
    cockpit: Cockpit
    prompt: string
    setup: TurnSetup | null
    start: ReturnType<typeof useSessionMutations>['start']
    setFailure: (failure: Failure | null) => void
  },
  afterStart: (sessionId: string) => Promise<void>,
  onStarted: (sessionId: string) => void,
) {
  const { cli, cockpit, prompt, setup, start, setFailure } = request
  if (cockpit.project === null) {
    setFailure({ sessionId: null, message: 'Select a Project before starting a Session.' })
    return false
  }
  try {
    const reply = await start.mutateAsync({ cli, cwd: cockpit.project.path, prompt, setup })
    setFailure(null)
    await afterStart(reply.sessionId)
    onStarted(reply.sessionId)
    return true
  } catch (error) {
    setFailure({
      sessionId: null,
      message: messageFrom(error, 'Argo could not start this Session.'),
    })
    return false
  }
}
