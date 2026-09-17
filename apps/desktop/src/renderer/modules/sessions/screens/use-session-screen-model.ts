// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { useProjects } from '../../projects/hooks/use-projects'
import type { WorkSelection } from '../components/inspector/session-inspector'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useSessionComposer } from '../hooks/use-session-composer'
import { useSessionPermission } from '../hooks/use-session-permission'
import { useSessionQuestion } from '../hooks/use-session-question'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../hooks/use-session-work'
import { useSessions } from '../hooks/use-sessions'
import { useComposerStore } from '../state/use-composer-store'
import { readableSessionId } from '../state/use-session-creation-store'
import type { SessionEvidence } from '../types'
import { sessionHarness } from './session-screen-state'
import { useSelectedSession } from './use-selected-session'

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

function useWorkArtifacts(
  session: ReturnType<typeof useSelectedSession>,
  selectedSessionId: string | null,
  work: WorkSelection,
) {
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation =
    session?.delegations.find((candidate) => candidate.id === work.delegationId) ?? null
  return {
    shell,
    delegation,
    delegationFeed: useDelegationFeed(selectedSessionId, delegation?.id ?? null),
    delegationUsage: useDelegationUsage(
      session === null || session.delegations.length === 0 ? null : selectedSessionId,
      session?.delegations.some((candidate) => !candidate.landed) === true,
    ),
    shellOutput: useShellOutput(selectedSessionId, shell?.id ?? null, shell?.state === 'running'),
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
  const { feed, feedError, roster, retryFeed } = useSessions(
    selectedSessionId,
    true,
    cockpit.project?.path ?? null,
  )
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
  const artifacts = useWorkArtifacts(session, selectedSessionId, work)
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
    ...artifacts,
  }
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
