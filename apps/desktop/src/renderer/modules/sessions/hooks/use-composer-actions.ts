import type { useQueryClient } from '@tanstack/react-query'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { SessionCli } from '../harness/harnesses'
import { type ComposerIdentity, findSessionRow } from './composer-identity'
import { useComposerMarker } from './use-composer-marker'
import { useHandoff, useHandoffCompletion } from './use-handoff-actions'
import type { Failure } from './use-session-composer-actions'
import { useCompactWithInvalidate, useInterrupt } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'
import type { useSessions } from './use-sessions'
import type { useTurnMarker } from './use-turn-marker'

export function managedSessionIsRunning(
  roster: ReturnType<typeof useSessions>['roster'],
  sessionId: string | null,
): boolean {
  const row = findSessionRow(roster, sessionId)
  return row?.posture === 'managed' && row.status === 'running'
}

// Bundles the mutations and the Turn Marker, whose availability and wiring all hinge on the same
// facts (the CLI, the current identity, and the selected roster row), so the main hook states
// each fact once.
export function useComposerActions(options: {
  cli: SessionCli
  identity: ComposerIdentity
  mutations: ReturnType<typeof useSessionMutations>
  marker: ReturnType<typeof useTurnMarker>
  roster: ReturnType<typeof useSessions>['roster']
  sessionId: string | null
  selectedRow: SessionRosterRow | null
  setFailure: (failure: Failure | null) => void
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const {
    cli,
    identity,
    mutations,
    marker,
    roster,
    sessionId,
    selectedRow,
    setFailure,
    queryClient,
  } = options
  const { compact, handoff, interrupt } = mutations
  const onCompact = useCompactWithInvalidate({ compact, sessionId, setFailure, queryClient })
  const onInterruptBase = useInterrupt(interrupt, sessionId, setFailure)
  const isHandingOff = (selectedRow?.handoffStartedAt ?? null) !== null
  const onHandoff = useHandoff(handoff, sessionId, setFailure)
  useHandoffCompletion({ isHandingOff, selectedRow, selectedSessionId: sessionId, setFailure })
  const { onInterrupt, markerView, optimisticRow } = useComposerMarker({
    marker,
    roster,
    identity,
    selectedRow,
    sessionId,
    onInterruptBase,
  })
  const sessionSelected = identity.kind === 'session'
  return {
    isHandingOff,
    onCompact: sessionSelected ? onCompact : undefined,
    onHandoff: cli === 'claude' && sessionSelected ? onHandoff : undefined,
    onInterrupt,
    markerView,
    optimisticRow,
  }
}
