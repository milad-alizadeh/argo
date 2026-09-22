import type { SessionHarness } from '../../harness'
import type { useQueryClient } from '@tanstack/react-query'
import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import type { useSessions } from '../../use-sessions'
import { type ComposerIdentity, findSessionRow } from '../identity'
import { useComposerMarker } from './use-composer-marker'
import { useHandoff, useHandoffCompletion } from './use-handoff-actions'
import type { Failure } from '../send'
import { useCompactWithInvalidate, useInterrupt, useSteer } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'
import type { useTurnMarker } from './use-turn-marker'

export function managedSessionIsRunning(
  roster: ReturnType<typeof useSessions>['roster'],
  sessionId: string | null,
): boolean {
  const row = findSessionRow(roster, sessionId)
  if (row?.posture !== 'managed') return false
  switch (row.status) {
    case 'running':
    case 'permission':
      return true
    default:
      return false
  }
}

export function isManagedSessionSelected(
  identity: ComposerIdentity,
  posture: SessionRosterRow['posture'] | null,
): boolean {
  return identity.kind === 'session' && posture === 'managed'
}

// Bundles the mutations and the Turn Marker, whose availability and wiring all hinge on the same
// facts (the Harness, the current identity, and the selected roster row), so the main hook states
// each fact once.
export function useComposerActions(options: {
  harness: SessionHarness
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
    harness,
    identity,
    mutations,
    marker,
    roster,
    sessionId,
    selectedRow,
    setFailure,
    queryClient,
  } = options
  const { compact, handoff, interrupt, steer } = mutations
  const onCompact = useCompactWithInvalidate({ compact, sessionId, setFailure, queryClient })
  const onInterruptBase = useInterrupt(interrupt, sessionId, setFailure)
  const onSteer = useSteer(steer, sessionId, setFailure)
  const isHandingOff = (selectedRow?.handoffStartedAt ?? null) !== null
  const onHandoff = useHandoff(handoff, sessionId, setFailure)
  useHandoffCompletion({ isHandingOff, selectedRow, selectedSessionId: sessionId, setFailure })
  const { onInterrupt, markerView, optimisticRow, settledPromptRow } = useComposerMarker({
    marker,
    roster,
    identity,
    selectedRow,
    sessionId,
    onInterruptBase,
  })
  const sessionSelected = identity.kind === 'session'
  const managedSessionSelected = isManagedSessionSelected(identity, selectedRow?.posture ?? null)
  return {
    isHandingOff,
    onCompact: managedSessionSelected ? onCompact : undefined,
    onHandoff: harness === 'claude' && sessionSelected ? onHandoff : undefined,
    onInterrupt,
    onSteer,
    markerView,
    optimisticRow,
    settledPromptRow,
  }
}
