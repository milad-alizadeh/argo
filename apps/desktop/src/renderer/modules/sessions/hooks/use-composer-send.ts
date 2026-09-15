import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../projects/hooks/use-projects'
import type { Send } from '../components/use-send'
import type { SessionCli } from '../harness/harnesses'
import type { useTurnSetup } from '../turn-setup/use-turn-setup'
import type { SessionsListed } from '../types'
import type { ComposerIdentity } from './composer-identity'
import { type SendDeps, sendToDraftIdentity, sendToSessionIdentity } from './send-turn'
import type { Failure } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'
import type { TurnMarkerApi } from './use-turn-marker'

export function useComposerSend(request: {
  cli: SessionCli
  cockpit: Cockpit
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  roster: SessionsListed | null
  identity: ComposerIdentity
  marker: TurnMarkerApi
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}): Send {
  const { identity, ...deps } = request
  const typedDeps: SendDeps = deps
  return async (prompt, setup, attachments) => {
    const turn = { prompt, setup, attachments }
    return identity.kind === 'session'
      ? sendToSessionIdentity(typedDeps, identity.sessionId, turn)
      : sendToDraftIdentity(typedDeps, identity, turn)
  }
}
