// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { useProjects } from '../../projects/hooks/useProjects'
import type { WorkSelection } from '../components/SessionInspector'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessionPermission } from '../hooks/useSessionPermission'
import { useSessionQuestion } from '../hooks/useSessionQuestion'
import { useSessions } from '../hooks/useSessions'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../hooks/useSessionWork'
import { useComposerStore } from '../state/useComposerStore'
import { readableSessionId } from '../state/useSessionCreationStore'
import type { SessionEvidence } from '../types'
import { sessionHarness } from './sessionScreenState'
import { useSelectedSession } from './useSelectedSession'

const NOTHING_PICKED: WorkSelection = { sessionId: null, delegationId: null, shellId: null }

function pickedIn(selection: WorkSelection, sessionId: string | null): WorkSelection {
  return selection.sessionId === sessionId ? selection : { ...NOTHING_PICKED, sessionId }
}

// Each pick counts, so picking the same row again reopens an inspector the reader collapsed.
function useWorkPick(sessionId: string | null, onPick: () => void) {
  const [picked, setPicked] = useState({ selection: NOTHING_PICKED, count: 0 })
  const work = pickedIn(picked.selection, sessionId)
  const pickedId = work.delegationId ?? work.shellId
  return {
    work,
    pick: (selection: WorkSelection) => {
      onPick()
      setPicked(({ count }) => ({ selection, count: count + 1 }))
    },
    workReveal: pickedId === null ? null : `${pickedId}#${picked.count}`,
  }
}

export function useSessionScreenModel() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const [evidence, setEvidence] = useState<SessionEvidence | null>(null)
  const { work, pick, workReveal } = useWorkPick(selectedSessionId, () => setEvidence(null))
  const { feed, feedError, roster, retryFeed } = useSessions(selectedSessionId)
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = useSelectedSession(selectedSessionId, roster)
  const harness = sessionHarness({ selectedSessionId, lastHarness, chooseHarness, session })
  const composer = useSessionComposer({
    cli: harness.cli,
    cockpit,
    focusOnMount: location.state === COMPOSER_FOCUS_STATE,
    navigate,
    roster,
    selectedSessionId,
  })
  // A Session that only exists as an optimistic Roster row has no backend record to poll yet
  // (#2109): the reader is asked for a Permission or a Question only once the id is a real one.
  const permission = useSessionPermission(readableSessionId(selectedSessionId))
  const question = useSessionQuestion(readableSessionId(selectedSessionId))
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation =
    session?.delegations.find((candidate) => candidate.id === work.delegationId) ?? null
  return {
    selectedSessionId,
    feed,
    feedError,
    retryFeed,
    roster,
    navigate,
    session,
    evidence,
    setEvidence,
    harness,
    composer,
    permission,
    question,
    work,
    pick,
    workReveal,
    shell,
    delegation,
    delegationFeed: useDelegationFeed(selectedSessionId, delegation?.id ?? null),
    delegationTokens: useDelegationUsage(
      session === null || session.delegations.length === 0 ? null : selectedSessionId,
      session?.delegations.some((candidate) => !candidate.landed) === true,
    ),
    shellOutput: useShellOutput(selectedSessionId, shell?.id ?? null, shell?.state === 'running'),
  }
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
