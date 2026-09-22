import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer'
import { promptOf } from '../../feed/rows/turn-marker-state'
import type { SessionHarness } from '../../harness/harnesses'
import type { useSessionMutations } from '../hooks/use-session-mutations'
import type { TurnMarkerApi } from '../hooks/use-turn-marker'
import { type ComposerIdentity, composerIdentityKey } from '../identity/composer-identity'
import type { useTurnSetup } from '../turn-setup/use-turn-setup'
import { sendToNewSession, type TurnInput } from './send-turn'
import type { Failure } from './session-failure'

export type DraftSendDeps = {
  harness: SessionHarness
  cockpit: Cockpit
  marker: TurnMarkerApi
  navigate: NavigateFunction
  onStarted?: (sessionId: string) => void
  queryClient: ReturnType<typeof useQueryClient>
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}

export async function sendToDraftIdentity(
  deps: DraftSendDeps,
  identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>,
  turn: TurnInput,
) {
  const {
    harness,
    cockpit,
    marker,
    navigate,
    onStarted,
    queryClient,
    send,
    setFailure,
    start,
    watchTurn,
  } = deps
  const key = composerIdentityKey(identity)
  // A duplicate Enter that the row drops must leave the first Send's Marker alone (#2229).
  let began = false
  const sent = await sendToNewSession({
    harness,
    cockpit,
    identity,
    navigate,
    queryClient,
    send,
    setFailure,
    start,
    turn,
    watchTurn,
    onSubmitted: () => {
      began = true
      marker.begin(key, { stage: 'starting', since: null, ...promptOf(turn) })
    },
    onStarted: (sessionId) => {
      marker.rekey(key, sessionId)
      onStarted?.(sessionId)
    },
  })
  if (!sent && began) marker.clear(key)
  return sent
}
