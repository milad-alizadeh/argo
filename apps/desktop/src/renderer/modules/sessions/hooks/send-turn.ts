import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { SessionAttachmentInput } from '@/core/sessions/attachments-contract'
import type { Cockpit } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { stageFor } from '../feed/turn-marker'
import type { SessionCli } from '../harness/harnesses'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { useTurnSetup } from '../turn-setup/useTurnSetup'
import type { SessionsListed } from '../types'
import { type ComposerIdentity, composerIdentityKey, findSessionRow } from './composerIdentity'
import type { Failure } from './useSessionComposer-actions'
import { sendMessage } from './useSessionComposer-actions'
import { startNewSession } from './useStartNewSession'
import type { useSessionMutations } from './useSessionMutations'
import type { TurnMarkerApi } from './useTurnMarker'

export type TurnInput = {
  prompt: string
  setup: TurnSetup | null
  attachments: SessionAttachmentInput[]
}

// Exported for direct testing: the send-routing decision itself needs no React to prove.
export function sendToSelected(request: {
  queryClient: ReturnType<typeof useQueryClient>
  since: string | null
  selectedSessionId: string
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  turn: TurnInput
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}) {
  const { queryClient, since, selectedSessionId, send, setFailure, turn, watchTurn } = request
  const { prompt, setup, attachments } = turn
  return sendMessage(
    { send, prompt, setup, attachments, sessionId: selectedSessionId, setFailure },
    () => {
      if (setup !== null) watchTurn(selectedSessionId, setup, since)
      // A Send can resume the Session (ADR-0026), so its posture may have changed.
      return invalidateSessionRoster(queryClient)
    },
  )
}

export function sendToNewSession(request: {
  cli: SessionCli
  cockpit: Cockpit
  identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  turn: TurnInput
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
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
    onStarted,
  } = request
  const { prompt, setup, attachments } = turn
  return startNewSession(
    { cli, cockpit, identity, prompt, setup, attachments, start, setFailure },
    {
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
  roster: SessionsListed | null
  marker: TurnMarkerApi
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}

export async function sendToSessionIdentity(deps: SendDeps, sessionId: string, turn: TurnInput) {
  const { queryClient, roster, marker, send, setFailure, watchTurn } = deps
  const row = findSessionRow(roster, sessionId)
  const since = row?.turnStartedAt ?? null
  marker.begin(sessionId, {
    stage: stageFor('session', row?.posture ?? null),
    since,
    prompt: turn.prompt,
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

export async function sendToDraftIdentity(
  deps: SendDeps,
  identity: Extract<ComposerIdentity, { kind: 'draft' | 'pending' }>,
  turn: TurnInput,
) {
  const { cli, cockpit, navigate, queryClient, marker, send, setFailure, start, watchTurn } = deps
  const key = composerIdentityKey(identity)
  marker.begin(key, { stage: 'starting', since: null, prompt: turn.prompt })
  const sent = await sendToNewSession({
    cli,
    cockpit,
    identity,
    navigate,
    queryClient,
    send,
    setFailure,
    start,
    turn,
    watchTurn,
    onStarted: (sessionId) => marker.rekey(key, sessionId),
  })
  if (!sent) marker.clear(key)
  return sent
}
