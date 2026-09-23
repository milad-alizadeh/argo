import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import { COMPOSER_FOCUS_STATE } from '../../composer-focus-state'
import { promptOf, stageFor } from '../../feed/rows/turn-marker-state'
import { type SessionHarness, sessionHarnessOf } from '../../harness/harnesses'
import { invalidateSessionRoster } from '../../session-queries'
import type { SessionRoster } from '../../types'
import type { SendOutcome } from '../hooks/use-send'
import type { useSessionMutations } from '../hooks/use-session-mutations'
import type { TurnMarkerApi } from '../hooks/use-turn-marker'
import { type ComposerIdentity, findSessionRow } from '../identity/composer-identity'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { useTurnSetup } from '../turn-setup/use-turn-setup'
import { sendManagedSessionTurn } from './send-managed-session-turn'
import { sendToSelected } from './send-selected-turn'
import type { Failure } from './session-failure'
import { startNewSession } from './use-start-new-session'

export type TurnInput = {
  prompt: string
  setup: TurnSetup | null
  attachments: SessionAttachmentInput[]
}

// Exported for direct testing: the send-routing decision itself needs no React to prove.
export { sendToSelected } from './send-selected-turn'

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
      // The SDK-backed Claude adapter delivers `turn.prompt` as part of `start` itself now (it has
      // to: the SDK only identifies a session once it has read a first prompt off the stream), so a
      // second send here would resubmit the same turn (#e2e-real-cheap-models).
      sendInitialTurn: undefined,
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
    sendManagedSession: (request: {
      harness: SessionHarness
      sessionId: string
      prompt: string
      setup?: TurnSetup | null
    }) => Promise<SessionCommandOutcome>
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
