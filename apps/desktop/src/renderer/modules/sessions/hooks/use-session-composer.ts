import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { SessionErrorCode } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { Cockpit } from '../../projects/hooks/use-projects'
import type { SessionComposerProps } from '../components/composer/session-composer'
import type { Send } from '../components/composer/use-send'
import type { TurnMarkerView } from '../feed/turn-marker-state'
import { HARNESSES, type SessionCli } from '../harness/harnesses'
import { useSessionCreationStore } from '../state/use-session-creation-store'
import { useTurnSetup } from '../turn-setup/use-turn-setup'
import type { SessionFeedRow } from '../types'
import { composerIdentityOf, findSessionRow } from './composer-identity'
import { composerProps } from './composer-props'
import { sendToDraftIdentity, sendToSessionIdentity } from './send-turn'
import { useComposerActions } from './use-composer-actions'
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
  return { identity, sessionId, control, watchTurn, marker, selectedRow }
}

export function useSessionComposer(options: SessionComposerOptions): ComposerResult {
  const { cli, cockpit, focusOnMount, navigate, roster, selectedSessionId } = options
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
  const onSend: Send = useCallback(
    (prompt, setup, attachments) => {
      const turn = { prompt, setup, attachments }
      return identity.kind === 'session'
        ? sendToSessionIdentity(
            { queryClient, roster, marker, send, setFailure, watchTurn },
            identity.sessionId,
            turn,
          )
        : sendToDraftIdentity(
            { cli, cockpit, navigate, queryClient, marker, send, setFailure, start, watchTurn },
            identity,
            turn,
          )
    },
    [cli, cockpit, identity, marker, navigate, queryClient, roster, send, start, watchTurn],
  )
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
