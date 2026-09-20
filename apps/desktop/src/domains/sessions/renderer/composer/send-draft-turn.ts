import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/hooks/use-projects'
import {
  type ComposerIdentity,
  composerIdentityKey,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { sendToNewSession, type TurnInput } from '@/domains/sessions/renderer/composer/send-turn'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import type { TurnMarkerApi } from '@/domains/sessions/renderer/composer/use-turn-marker'
import { promptOf } from '@/domains/sessions/renderer/feed/turn-marker-state'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import type { useTurnSetup } from '@/domains/sessions/renderer/turn-setup/use-turn-setup'

export type DraftSendDeps = {
  harness: SessionHarness
  cockpit: Cockpit
  marker: TurnMarkerApi
  navigate: NavigateFunction
  onStarted?: (sessionId: string) => void
  queryClient: ReturnType<typeof useQueryClient>
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
