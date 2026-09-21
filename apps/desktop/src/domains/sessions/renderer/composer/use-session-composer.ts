import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/port'
import type { SessionErrorCode } from '@/domains/sessions/contract/ipc/contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import {
  composerIdentityKey,
  composerIdentityOf,
  findSessionRow,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { composerSend } from '@/domains/sessions/renderer/composer/composer-send'
import type { SessionComposerProps } from '@/domains/sessions/renderer/composer/session-composer'
import {
  managedSessionIsRunning,
  useComposerActions,
} from '@/domains/sessions/renderer/composer/use-composer-actions'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import { useTurnMarker } from '@/domains/sessions/renderer/composer/use-turn-marker'
import type { TurnMarkerView } from '@/domains/sessions/renderer/feed/turn-marker-state'
import { HARNESSES, type SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { useSessionCreationStore } from '@/domains/sessions/renderer/session-creation'
import { useTurnSetup } from '@/domains/sessions/renderer/turn-setup/use-turn-setup'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'

const NO_ROWS: SessionRosterRow[] = []

type SessionComposerOptions = {
  harness: SessionHarness
  cockpit: Cockpit
  focusOnMount: boolean
  navigate: NavigateFunction
  roster: ReturnType<typeof useSessions>['roster']
  selectedSessionId: string | null
}

type ComposerResult = {
  failure: { message: string; code: SessionErrorCode | null } | null
  retry: () => void
  props: Omit<SessionComposerProps, 'plan' | 'harness'>
  markerView: TurnMarkerView | null
  optimisticRow: SessionFeedRow | null
  settledPromptRow: SessionFeedRow | null
}

// The facts the setup pane, the mutations, and the Turn Marker all need before they can be wired:
// who is selected, and the harness setup control that goes with them.
function useComposerFacts(
  options: Pick<SessionComposerOptions, 'harness' | 'cockpit' | 'roster' | 'selectedSessionId'>,
  setFailure: (failure: Failure | null) => void,
) {
  const { harness, cockpit, roster, selectedSessionId } = options
  // The "+" click already gave this row a pending identity (#2109); a bare selection has none.
  const pending = useSessionCreationStore((state) => state.pending)
  const pendingSessionId = pending?.stage === 'draft' ? pending.id : null
  const identity = composerIdentityOf(
    selectedSessionId,
    cockpit.project?.id ?? null,
    pendingSessionId,
  )
  const sessionId = identity.kind === 'session' ? identity.sessionId : null
  const { control, watchTurn } = useTurnSetup({
    harness,
    choices: HARNESSES[harness].setup,
    identity,
    rows: roster?.sessions ?? NO_ROWS,
    onRefusal: (refusal) => setFailure({ ...refusal, code: null }),
  })
  const marker = useTurnMarker()
  const selectedRow = findSessionRow(roster, sessionId)
  return {
    identity,
    sessionId,
    control,
    watchTurn,
    marker,
    selectedRow,
    isCompacting: (selectedRow?.compactionStartedAt ?? null) !== null,
  }
}

export function useSessionComposer(options: SessionComposerOptions): ComposerResult {
  const { harness, cockpit, focusOnMount, navigate, roster, selectedSessionId } = options
  const [failure, setFailure] = useState<Failure | null>(null)
  const queryClient = useQueryClient()
  const mutations = useSessionMutations()
  const composerActions = useComposerStore.getState()
  const { identity, sessionId, control, watchTurn, marker, selectedRow, isCompacting } =
    useComposerFacts({ harness, cockpit, roster, selectedSessionId }, setFailure)
  const { isHandingOff, onCompact, onHandoff, onInterrupt, onSteer, ...marks } = useComposerActions(
    {
      harness,
      identity,
      mutations,
      marker,
      roster,
      sessionId,
      selectedRow,
      setFailure,
      queryClient,
    },
  )
  const onSend = composerSend({
    harness,
    cockpit,
    identity,
    marker,
    navigate,
    queryClient,
    roster,
    send: mutations.send,
    setDraft: composerActions.setDraft,
    removeAttachmentPaths: composerActions.removeAttachmentPaths,
    rekey: composerActions.rekey,
    setFailure,
    start: mutations.start,
    watchTurn,
  })
  return {
    failure:
      failure?.sessionId === sessionId ? { message: failure.message, code: failure.code } : null,
    retry: () => setFailure(null),
    ...marks,
    props: {
      focusOnMount,
      isCompacting,
      isHandingOff,
      isRunning: managedSessionIsRunning(roster, sessionId),
      onCompact,
      onHandoff,
      onInterrupt,
      onSteer,
      onSend,
      sessionId: composerIdentityKey(identity),
      setup: control,
    },
  }
}
