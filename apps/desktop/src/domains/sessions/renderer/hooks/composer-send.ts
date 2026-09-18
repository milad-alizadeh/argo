import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../../projects/renderer/hooks/use-projects'
import type { Send } from '../components/composer/use-send'
import type { SessionCli } from '../harness/harnesses'
import type { ComposerState } from '../state/use-composer-store'
import type { useTurnSetup } from '../turn-setup/use-turn-setup'
import type { ComposerIdentity } from './composer-identity'
import { sendToDraftIdentity } from './send-draft-turn'
import { sendToSessionIdentity } from './send-turn'
import type { Failure } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'
import type { useSessions } from './use-sessions'
import type { TurnMarkerApi } from './use-turn-marker'

type ComposerSendOptions = {
  cli: SessionCli
  cockpit: Cockpit
  identity: ComposerIdentity
  marker: TurnMarkerApi
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  roster: ReturnType<typeof useSessions>['roster']
  send: ReturnType<typeof useSessionMutations>['send']
  setDraft: ComposerState['setDraft']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}

export function composerSend(options: ComposerSendOptions): Send {
  const {
    cli,
    cockpit,
    identity,
    marker,
    navigate,
    queryClient,
    roster,
    send,
    setDraft,
    setFailure,
    start,
    watchTurn,
  } = options
  return async (prompt, setup, attachments) => {
    const turn = { prompt, setup, attachments }
    return identity.kind === 'session'
      ? sendToSessionIdentity(
          { queryClient, roster, marker, send, setFailure, watchTurn },
          identity.sessionId,
          turn,
        )
      : sendToDraftIdentity(
          {
            cli,
            cockpit,
            marker,
            navigate,
            onStarted: (sessionId) => setDraft(sessionId, ''),
            queryClient,
            setFailure,
            start,
            watchTurn,
          },
          identity,
          turn,
        )
  }
}
