import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { Send } from '../components/useSend'
import type { SessionCli } from '../harness/harnesses'
import type { useTurnSetup } from '../turn-setup/useTurnSetup'
import type { SessionsListed } from '../types'
import { type ComposerIdentity, composerIdentityKey } from './composerIdentity'
import { type SendDeps, sendToDraftIdentity, sendToSessionIdentity } from './send-turn'
import type { Failure } from './useSessionComposer-actions'
import type { useSessionMutations } from './useSessionMutations'
import type { TurnMarkerApi } from './useTurnMarker'

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
      : sendToDraftIdentity(typedDeps, composerIdentityKey(identity), turn)
  }
}
