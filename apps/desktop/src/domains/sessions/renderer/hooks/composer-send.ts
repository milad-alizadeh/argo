import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/hooks/use-projects'
import type { Send } from '@/domains/sessions/renderer/components/composer/use-send'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'
import type { ComposerIdentity } from '@/domains/sessions/renderer/hooks/composer-identity'
import { sendToDraftIdentity } from '@/domains/sessions/renderer/hooks/send-draft-turn'
import { sendToSessionIdentity } from '@/domains/sessions/renderer/hooks/send-turn'
import type { Failure } from '@/domains/sessions/renderer/hooks/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/hooks/use-session-mutations'
import type { useSessions } from '@/domains/sessions/renderer/hooks/use-sessions'
import type { TurnMarkerApi } from '@/domains/sessions/renderer/hooks/use-turn-marker'
import type { ComposerState } from '@/domains/sessions/renderer/state/use-composer-store'
import type { useTurnSetup } from '@/domains/sessions/renderer/turn-setup/use-turn-setup'

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
