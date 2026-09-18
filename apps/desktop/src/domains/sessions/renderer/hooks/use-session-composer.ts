import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '../../../projects/renderer/hooks/use-projects'
import type { SessionErrorCode } from '../../contract/contract'
import type { SessionRosterRow } from '../../contract/models'
import type { SessionComposerProps } from '../components/composer/session-composer'
import type { TurnMarkerView } from '../feed/turn-marker-state'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { useComposerStore } from '../state/use-composer-store'
import { useSessionCreationStore } from '../state/use-session-creation-store'
import { useTurnSetup } from '../turn-setup/use-turn-setup'
import type { SessionFeedRow } from '../types'
import { composerIdentityKey, composerIdentityOf, findSessionRow } from './composer-identity'
import { composerSend } from './composer-send'
import { managedSessionIsRunning, useComposerActions } from './use-composer-actions'
import type { Failure } from './use-session-composer-actions'
import { useSessionMutations } from './use-session-mutations'
import type { useSessions } from './use-sessions'
import { useTurnMarker } from './use-turn-marker'

const NO_ROWS: SessionRosterRow[] = []

type SessionComposerOptions = {
  cli: SessionCli
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
  options: Pick<SessionComposerOptions, 'cli' | 'cockpit' | 'roster' | 'selectedSessionId'>,
  setFailure: (failure: Failure | null) => void,
) {
  const { cli, cockpit, roster, selectedSessionId } = options
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
    cli,
    choices: HARNESSES[cli].setup,
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
  const { cli, cockpit, focusOnMount, navigate, roster, selectedSessionId } = options
  const [failure, setFailure] = useState<Failure | null>(null)
  const queryClient = useQueryClient()
  const mutations = useSessionMutations()
  const setDraft = useComposerStore((state) => state.setDraft)
  const { identity, sessionId, control, watchTurn, marker, selectedRow, isCompacting } =
    useComposerFacts({ cli, cockpit, roster, selectedSessionId }, setFailure)
  const { isHandingOff, onCompact, onHandoff, onInterrupt, ...marks } = useComposerActions({
    cli,
    identity,
    mutations,
    marker,
    roster,
    sessionId,
    selectedRow,
    setFailure,
    queryClient,
  })
  const onSend = composerSend({
    cli,
    cockpit,
    identity,
    marker,
    navigate,
    queryClient,
    roster,
    send: mutations.send,
    setDraft,
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
      onSend,
      sessionId: composerIdentityKey(identity),
      setup: control,
    },
  }
}
