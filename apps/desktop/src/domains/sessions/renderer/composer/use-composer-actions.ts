import type { useQueryClient } from '@tanstack/react-query'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import {
  type ComposerIdentity,
  findSessionRow,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { useComposerMarker } from '@/domains/sessions/renderer/composer/use-composer-marker'
import {
  useHandoff,
  useHandoffCompletion,
} from '@/domains/sessions/renderer/composer/use-handoff-actions'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import {
  useCompactWithInvalidate,
  useInterrupt,
} from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import type { useTurnMarker } from '@/domains/sessions/renderer/composer/use-turn-marker'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'

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
  const { onInterrupt, markerView, optimisticRow, settledPromptRow } = useComposerMarker({
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
    settledPromptRow,
  }
}
