import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/port'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import {
  type ComposerIdentity,
  findSessionRow,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { sendToSelected } from '@/domains/sessions/renderer/composer/send-selected-turn'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import { startNewSession } from '@/domains/sessions/renderer/composer/use-start-new-session'
import type { TurnMarkerApi } from '@/domains/sessions/renderer/composer/use-turn-marker'
import { COMPOSER_FOCUS_STATE } from '@/domains/sessions/renderer/composer-focus-state'
import { promptOf, stageFor } from '@/domains/sessions/renderer/feed/turn-marker-state'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'
import { invalidateSessionRoster } from '@/domains/sessions/renderer/session-queries'
import type { TurnSetup } from '@/domains/sessions/renderer/turn-setup/turn-setup'
import type { useTurnSetup } from '@/domains/sessions/renderer/turn-setup/use-turn-setup'
import type { SessionRoster } from '@/domains/sessions/renderer/types'

export type TurnInput = {
  prompt: string
  setup: TurnSetup | null
  attachments: SessionAttachmentInput[]
}

// Exported for direct testing: the send-routing decision itself needs no React to prove.
export { sendToSelected } from '@/domains/sessions/renderer/composer/send-selected-turn'

export function sendToNewSession(request: {
  cli: SessionCli
  cockpit: Cockpit
  identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  setFailure: (failure: Failure | null) => void
  start: Pick<ReturnType<typeof useSessionMutations>['start'], 'mutateAsync'>
  turn: TurnInput
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
  onSubmitted?: () => void
  // Fires with the real Session id as soon as it is known, before the navigate that follows: the
  // Marker begun under the draft composer's key lives there too.
  onStarted?: (sessionId: string) => void
}) {
  const {
    cli,
    cockpit,
    identity,
    navigate,
    queryClient,
    setFailure,
    start,
    turn,
    watchTurn,
    onSubmitted,
    onStarted,
  } = request
  const { prompt, setup, attachments } = turn
  return startNewSession(
    { cli, cockpit, identity, prompt, setup, attachments, start, setFailure },
    {
      onSubmitted: () => onSubmitted?.(),
      afterStart: (sessionId) => {
        if (setup !== null) watchTurn(sessionId, setup, null)
        return invalidateSessionRoster(queryClient)
      },
      onStarted: (sessionId) => {
        onStarted?.(sessionId)
        navigate(`/sessions/${sessionId}`, { replace: true, state: COMPOSER_FOCUS_STATE })
      },
      onFailed: () => navigate('/sessions/new', { replace: true }),
    },
  )
}

export type SendDeps = {
  cli: SessionCli
  cockpit: Cockpit
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  roster: SessionRoster | null
  marker: TurnMarkerApi
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
  onStarted?: (sessionId: string) => void
}

export async function sendToSessionIdentity(
  deps: Pick<SendDeps, 'marker' | 'queryClient' | 'roster' | 'send' | 'setFailure' | 'watchTurn'>,
  sessionId: string,
  turn: TurnInput,
) {
  const { queryClient, roster, marker, send, setFailure, watchTurn } = deps
  const row = findSessionRow(roster, sessionId)
  const since = row?.turnStartedAt ?? null
  marker.begin(sessionId, {
    stage: stageFor('session', row?.posture ?? null),
    since,
    ...promptOf(turn),
  })
  const sent = await sendToSelected({
    queryClient,
    since,
    selectedSessionId: sessionId,
    send,
    setFailure,
    turn,
    watchTurn,
  })
  if (!sent) marker.clear(sessionId)
  return sent
}
