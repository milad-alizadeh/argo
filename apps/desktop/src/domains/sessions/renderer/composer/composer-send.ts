import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/hooks/use-projects'
import type { ComposerIdentity } from '@/domains/sessions/renderer/composer/composer-identity'
import { sendToDraftIdentity } from '@/domains/sessions/renderer/composer/send-draft-turn'
import { sendToSessionIdentity } from '@/domains/sessions/renderer/composer/send-turn'
import type { ComposerState } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { Send } from '@/domains/sessions/renderer/composer/use-send'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import type { TurnMarkerApi } from '@/domains/sessions/renderer/composer/use-turn-marker'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'
import type { useTurnSetup } from '@/domains/sessions/renderer/turn-setup/use-turn-setup'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'

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
