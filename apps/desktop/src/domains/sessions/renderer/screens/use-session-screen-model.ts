// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import { useComposerStore } from '../composer/hooks/use-composer-store'
import { useSessionComposer } from '../composer/hooks/use-session-composer'
import { useSessionPermission } from '../composer/hooks/use-session-permission'
import { useSessionQuestion } from '../composer/hooks/use-session-question'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { workInspectorReveal } from '../inspector/work-inspector-reveal'
import { readableSessionId } from '../session-creation'
import type { SessionEvidence } from '../types'
import { useSessions } from '../use-sessions'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../work/use-session-work'
import { sessionHarness } from './session-screen-state'
import { useSelectedSession } from './use-selected-session'
import { useWorkPick, type WorkSelection } from './work-selection'

function useWorkArtifacts(
  session: ReturnType<typeof useSelectedSession>,
  selectedSessionId: string | null,
  work: WorkSelection,
) {
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation =
    session?.subagents.find((candidate) => candidate.id === work.subagentId) ?? null
  const delegationFeed = useDelegationFeed(selectedSessionId, delegation?.id ?? null)
  return {
    shell,
    delegation,
    delegationFeed: delegationFeed.feed,
    delegationFeedError: delegationFeed.feedError,
    retryDelegationFeed: delegationFeed.retry,
    subagentUsage: useDelegationUsage(
      session === null || session.subagents.length === 0 ? null : selectedSessionId,
      session?.subagents.some((candidate) => candidate.state === 'running') === true,
    ),
    shellOutput: useShellOutput(selectedSessionId, shell?.id ?? null, shell?.state === 'running'),
  }
}

export function useSessionScreenModel() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit, projectActions] = useProjects()
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
    harness: harness.harness,
    cockpit,
    projectActions,
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
  const inspectorReveal = workInspectorReveal(workReveal, artifacts.shell, artifacts.shellOutput)
  return {
    isNewSession: sessionId === 'new',
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
    workReveal: inspectorReveal,
    ...artifacts,
  }
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
