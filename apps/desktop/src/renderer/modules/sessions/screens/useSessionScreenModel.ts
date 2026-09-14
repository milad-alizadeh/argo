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
import type { SessionEvidence } from '../types'
import { sessionHarness } from './sessionScreenState'
import { useSelectedSession } from './useSelectedSession'

const NOTHING_PICKED: WorkSelection = { sessionId: null, delegationId: null, shellId: null }

function pickedIn(selection: WorkSelection, sessionId: string | null): WorkSelection {
  return selection.sessionId === sessionId ? selection : { ...NOTHING_PICKED, sessionId }
}

export function useSessionScreenModel() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const [picked, setPicked] = useState<WorkSelection>(NOTHING_PICKED)
  const work = pickedIn(picked, selectedSessionId)
  const { feed, feedError, roster } = useSessions(selectedSessionId)
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = useSelectedSession(selectedSessionId, roster)
  const [evidence, setEvidence] = useState<SessionEvidence | null>(null)
  const harness = sessionHarness({ selectedSessionId, lastHarness, chooseHarness, session })
  const composer = useSessionComposer({
    cli: harness.cli,
    cockpit,
    focusOnMount: location.state === COMPOSER_FOCUS_STATE,
    navigate,
    roster,
    selectedSessionId,
  })
  const permission = useSessionPermission(selectedSessionId)
  const question = useSessionQuestion(selectedSessionId)
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation =
    session?.delegations.find((candidate) => candidate.id === work.delegationId) ?? null
  return {
    selectedSessionId,
    feed,
    feedError,
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
    setPicked,
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
