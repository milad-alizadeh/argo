import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/port'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import {
  type ComposerIdentity,
  findSessionRow,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { sendInitialClaudeTurn } from '@/domains/sessions/renderer/composer/send-initial-claude-turn'
import { sendManagedSessionTurn } from '@/domains/sessions/renderer/composer/send-managed-session-turn'
import { sendToSelected } from '@/domains/sessions/renderer/composer/send-selected-turn'
import type { SendOutcome } from '@/domains/sessions/renderer/composer/use-send'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import { startNewSession } from '@/domains/sessions/renderer/composer/use-start-new-session'
import type { TurnMarkerApi } from '@/domains/sessions/renderer/composer/use-turn-marker'
import { COMPOSER_FOCUS_STATE } from '@/domains/sessions/renderer/composer-focus-state'
import { promptOf, stageFor } from '@/domains/sessions/renderer/feed/rows/turn-marker-state'
import {
  type SessionHarness,
  sessionHarnessOf,
} from '@/domains/sessions/renderer/harness/harnesses'
import { invalidateSessionRoster } from '@/domains/sessions/renderer/session-queries'
import type { TurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/turn-setup'
import type { useTurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/use-turn-setup'
import type { SessionRoster } from '@/domains/sessions/renderer/types'

export type TurnInput = {
  prompt: string
  setup: TurnSetup | null
  attachments: SessionAttachmentInput[]
}

// Exported for direct testing: the send-routing decision itself needs no React to prove.
export { sendToSelected } from '@/domains/sessions/renderer/composer/send-selected-turn'

export function sendToNewSession(request: {
  harness: SessionHarness
  cockpit: Cockpit
  identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  send: ReturnType<typeof useSessionMutations>['send']
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
    onSubmitted,
    onStarted,
  } = request
  const { prompt, setup, attachments } = turn
  return startNewSession(
    { harness, cockpit, identity, prompt, setup, attachments, start, setFailure },
    {
      onSubmitted: () => onSubmitted?.(),
      afterStart: (sessionId) => {
        if (setup !== null) watchTurn(sessionId, setup, null)
        return invalidateSessionRoster(queryClient)
      },
      sendInitialTurn: harness === 'claude' ? sendInitialClaudeTurn(send, turn) : undefined,
      onStarted: (sessionId) => {
        onStarted?.(sessionId)
        navigate(`/sessions/${sessionId}`, { replace: true, state: COMPOSER_FOCUS_STATE })
      },
      onFailed: () => navigate('/sessions/new', { replace: true }),
    },
  )
}

export type SendDeps = {
  harness: SessionHarness
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
  deps: Pick<
    SendDeps,
    'marker' | 'queryClient' | 'roster' | 'send' | 'setFailure' | 'watchTurn'
  > & {
    sendManagedSession: (
      harness: SessionHarness,
      sessionId: string,
      prompt: string,
    ) => Promise<SessionCommandOutcome>
  },
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
  const harness = sessionHarnessOf(row)
  const sendManaged =
    row?.posture === 'managed' &&
    turn.attachments.length === 0 &&
    (harness === 'codex' || turn.setup === null)
  const sent: SendOutcome | boolean = sendManaged
    ? await sendManagedSessionTurn({
        deps,
        harness,
        sessionId,
        turn,
        since,
      })
    : await sendToSelected({
        queryClient,
        since,
        selectedSessionId: sessionId,
        send,
        setFailure,
        turn,
        watchTurn,
      })
  if (sent === false || sent === 'rejected') marker.clear(sessionId)
  return sent
}
