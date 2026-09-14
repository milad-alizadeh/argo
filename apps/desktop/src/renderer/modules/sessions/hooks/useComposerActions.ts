import type { useQueryClient } from '@tanstack/react-query'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { SessionCli } from '../harness/harnesses'
import { type ComposerIdentity, findSessionRow } from './composerIdentity'
import { useComposerMarker } from './useComposerMarker'
import { useHandoff, useHandoffCompletion } from './useHandoffActions'
import type { Failure } from './useSessionComposer-actions'
import { useCompactWithInvalidate, useInterrupt } from './useSessionComposer-actions'
import type { useSessionMutations } from './useSessionMutations'
import type { useSessions } from './useSessions'
import type { useTurnMarker } from './useTurnMarker'

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
