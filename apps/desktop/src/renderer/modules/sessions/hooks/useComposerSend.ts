import type { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import type { SessionCli } from '../harness/harnesses'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { useTurnSetup } from '../turn-setup/useTurnSetup'
import type { SessionsListed } from '../types'
import type { ComposerIdentity } from './composerIdentity'
import type { Failure } from './useSessionComposer-actions'
import { sendMessage, startNewSession } from './useSessionComposer-actions'
import type { useSessionMutations } from './useSessionMutations'

// Exported for direct testing: the send-routing decision itself needs no React to prove.
export function sendToSelected(request: {
  queryClient: ReturnType<typeof useQueryClient>
  roster: SessionsListed | null
  selectedSessionId: string
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  prompt: string
  setup: TurnSetup | null
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}) {
  const { queryClient, roster, selectedSessionId, send, setFailure, prompt, setup, watchTurn } =
    request
  const since = roster?.sessions.find(({ id }) => id === selectedSessionId)?.turnStartedAt ?? null
  return sendMessage({ send, prompt, setup, sessionId: selectedSessionId, setFailure }, () => {
    if (setup !== null) watchTurn(selectedSessionId, setup, since)
    // A Send can resume the Session (ADR-0026), so its posture may have changed.
    return invalidateSessionRoster(queryClient)
  })
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
  prompt: string
  setup: TurnSetup | null
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}) {
  const { cli, cockpit, identity, navigate, queryClient, setFailure, start, prompt, setup, watchTurn } =
    request
  return startNewSession(
    { cli, cockpit, identity, prompt, setup, start, setFailure },
    (sessionId) => {
      if (setup !== null) watchTurn(sessionId, setup, null)
      return invalidateSessionRoster(queryClient)
    },
    (sessionId) => navigate(`/sessions/${sessionId}`, { replace: true, state: COMPOSER_FOCUS_STATE }),
    () => navigate('/sessions/new', { replace: true }),
  )
}

export function useComposerSend(request: {
  cli: SessionCli
  cockpit: Cockpit
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  roster: SessionsListed | null
  identity: ComposerIdentity
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}) {
  const {
    cli,
    cockpit,
    navigate,
    queryClient,
    roster,
    identity,
    send,
    setFailure,
    start,
    watchTurn,
  } = request
  return useCallback(
    async (prompt: string, setup: TurnSetup | null) => {
      if (identity.kind === 'session') {
        return sendToSelected({
          queryClient,
          roster,
          selectedSessionId: identity.sessionId,
          send,
          setFailure,
          prompt,
          setup,
          watchTurn,
        })
      }
      return sendToNewSession({
        cli,
        cockpit,
        identity,
        navigate,
        queryClient,
        send,
        setFailure,
        start,
        prompt,
        setup,
        watchTurn,
      })
    },
    [cli, cockpit, navigate, queryClient, roster, identity, send, setFailure, start, watchTurn],
  )
}
