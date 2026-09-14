import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/useProjects'
import type { SessionComposerProps } from '../components/SessionComposer'
import type { TurnMarkerView } from '../feed/turn-marker'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { useTurnSetup } from '../turn-setup/useTurnSetup'
import type { SessionFeedRow } from '../types'
import { composerIdentityKey, composerIdentityOf, findSessionRow } from './composerIdentity'
import { managedSessionIsRunning, useComposerActions } from './useComposerActions'
import { useComposerSend } from './useComposerSend'
import type { Failure } from './useSessionComposer-actions'
import { useSessionMutations } from './useSessionMutations'
import type { useSessions } from './useSessions'
import { useTurnMarker } from './useTurnMarker'

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
}

// The facts the setup pane, the mutations, and the Turn Marker all need before they can be wired:
// who is selected, and the harness setup control that goes with them.
function useComposerFacts(
  options: Pick<SessionComposerOptions, 'cli' | 'cockpit' | 'roster' | 'selectedSessionId'>,
  setFailure: (failure: Failure | null) => void,
) {
  const { cli, cockpit, roster, selectedSessionId } = options
  const identity = composerIdentityOf(selectedSessionId, cockpit.project?.id ?? null)
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
  return { identity, sessionId, control, watchTurn, marker, selectedRow }
}

export function useSessionComposer({
  cli,
  cockpit,
  focusOnMount,
  navigate,
  roster,
  selectedSessionId,
}: SessionComposerOptions): ComposerResult {
  const [failure, setFailure] = useState<Failure | null>(null)
  const queryClient = useQueryClient()
  const mutations = useSessionMutations()
  const { send, start } = mutations
  const { identity, sessionId, control, watchTurn, marker, selectedRow } = useComposerFacts(
    { cli, cockpit, roster, selectedSessionId },
    setFailure,
  )
  const { isHandingOff, onCompact, onHandoff, onInterrupt, markerView, optimisticRow } =
    useComposerActions({
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
  const isCompacting = (selectedRow?.compactionStartedAt ?? null) !== null
  const onSend = useComposerSend({
    cli,
    cockpit,
    navigate,
    queryClient,
    roster,
    identity,
    marker,
    send,
    setFailure,
    start,
    watchTurn,
  })
  return {
    failure:
      failure?.sessionId === sessionId ? { message: failure.message, code: failure.code } : null,
    retry: () => setFailure(null),
    markerView,
    optimisticRow,
    props: composerProps({
      roster,
      sessionId,
      focusOnMount,
      isCompacting,
      isHandingOff,
      onCompact,
      onHandoff,
      onInterrupt,
      onSend,
      identity,
      control,
    }),
  }
}

function composerProps(input: {
  roster: SessionComposerOptions['roster']
  sessionId: string | null
  focusOnMount: boolean
  isCompacting: boolean
  isHandingOff: boolean
  onCompact: (() => Promise<boolean>) | undefined
  onHandoff: (() => Promise<boolean>) | undefined
  onInterrupt: () => Promise<boolean>
  onSend: SessionComposerProps['onSend']
  identity: ReturnType<typeof composerIdentityOf>
  control: SessionComposerProps['setup']
}): Omit<SessionComposerProps, 'plan' | 'harness'> {
  const { roster, sessionId, identity, control, ...rest } = input
  return {
    ...rest,
    isRunning: managedSessionIsRunning(roster, sessionId),
    sessionId: composerIdentityKey(identity),
    setup: control,
  }
}
