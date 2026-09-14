import type { QueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE } from '../components/SessionComposer'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { messageFrom } from './useSessionActions'
import type { SessionMutations } from './useSessionComposer'

type Failure = { sessionId: string | null; message: string }

export async function startSession({
  cockpit,
  navigate,
  prompt,
  queryClient,
  setFailure,
  setup,
  start,
  watchTurn,
}: {
  cockpit: Cockpit
  navigate: NavigateFunction
  prompt: string
  queryClient: QueryClient
  setFailure: (failure: Failure | null) => void
  setup: TurnSetup | null
  start: SessionMutations['start']
  watchTurn: (sessionId: string, setup: TurnSetup, since: string | null) => void
}) {
  if (cockpit.project === null) {
    setFailure({ sessionId: null, message: 'Select a Project before starting a Session.' })
    return false
  }
  try {
    const reply = await start.mutateAsync({ cwd: cockpit.project.path, prompt, setup })
    setFailure(null)
    if (setup !== null) watchTurn(reply.sessionId, setup, null)
    await invalidateSessionRoster(queryClient)
    navigate(`/sessions/${reply.sessionId}`, { state: COMPOSER_FOCUS_STATE })
    return true
  } catch (error) {
    setFailure({
      sessionId: null,
      message: messageFrom(error, 'Argo could not start this Session.'),
    })
    return false
  }
}

export async function sendMessage(
  request: {
    send: SessionMutations['send']
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
