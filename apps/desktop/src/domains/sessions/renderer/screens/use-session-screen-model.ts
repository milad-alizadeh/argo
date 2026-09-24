// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import { useComposerStore } from '../composer/hooks/use-composer-store'
import { useSessionPermission } from '../composer/hooks/use-session-permission'
import { useSessionQuestion } from '../composer/hooks/use-session-question'
import { workInspectorReveal } from '../inspector/work-inspector-reveal'
import { readableSessionId } from '../session-creation'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { useSessions } from '../use-sessions'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../work/use-session-work'
import { sessionHarness } from './session-screen-state'
import { sessionScreenSubagents } from './session-screen-subagents'
import { useSelectedSession } from './use-selected-session'
import { useWorkPick, type WorkSelection } from './work-selection'

function useScreenSessionFeed(sessionId: string | null, projectPath: string | null) {
  return useSessions(sessionId, true, projectPath)
}

function useWorkArtifacts({
  session,
  selectedSessionId,
  work,
  feedRows,
}: {
  session: ReturnType<typeof useSelectedSession>
  selectedSessionId: string | null
  work: WorkSelection
  feedRows: readonly SessionFeedRow[]
}) {
  const subagents = sessionScreenSubagents(feedRows, session?.subagents ?? [])
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation = subagents.find((candidate) => candidate.id === work.subagentId) ?? null
  const delegationFeed = useDelegationFeed(selectedSessionId, delegation?.id ?? null)
  return {
    shell,
    delegation,
    delegationFeed: delegationFeed.feed,
    delegationFeedError: delegationFeed.feedError,
    retryDelegationFeed: delegationFeed.retry,
    subagentUsage: useDelegationUsage(
      subagents.length === 0 ? null : selectedSessionId,
      subagents.some((candidate) => candidate.state === 'running'),
    ),
    shellOutput: useShellOutput(selectedSessionId, shell?.id ?? null, shell?.state === 'running'),
    subagents,
  }
}

export function useSessionScreenModel() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [cockpit, projectActions] = useProjects()
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const [evidence, setEvidence] = useState<SessionEvidence | null>(null)
  const { work, pick, workReveal } = useWorkPick(selectedSessionId, () => setEvidence(null))
  const { feed, feedError, roster, retryFeed } = useScreenSessionFeed(
    selectedSessionId,
    cockpit.project?.path ?? null,
  )
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = useSelectedSession(selectedSessionId, roster)
  const harness = sessionHarness({ selectedSessionId, lastHarness, chooseHarness, session })
  // Ask only real Session ids; an optimistic Roster row has no backend record yet (#2109).
  const permission = useSessionPermission(readableSessionId(selectedSessionId)),
    question = useSessionQuestion(readableSessionId(selectedSessionId))
  const artifacts = useWorkArtifacts({
    session,
    selectedSessionId,
    work,
    feedRows: feed?.rows ?? [],
  })
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
    cockpit,
    projectActions,
    permission,
    question,
    work,
    pick,
    workReveal: inspectorReveal,
    ...artifacts,
  }
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
