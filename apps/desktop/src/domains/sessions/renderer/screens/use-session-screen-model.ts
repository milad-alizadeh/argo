// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import type { FeedSubagent } from '@/domains/sessions/api/feed'
import { useWorkspaces } from '@/domains/workspaces/renderer'
import { DEFAULT_HARNESS, type Harness } from '@/harnesses/harness'
import { useSessionPermission, useSessionQuestion } from '../composer'
import { useFeedReading } from '../feed'
import { workInspectorReveal } from '../inspector'
import type { Session, SessionEvidence, SessionExtras } from '../types'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../work'
import { sessionHarness } from './session-screen-state'
import { pickedSubagent, sessionScreenSubagents } from './session-screen-subagents'
import { sessionWorkspaceIdentity } from './session-screen-workspace'
import { useSessionDetails } from './use-session-details'
import { useWorkPick, type WorkSelection } from './work-selection'

// The Shell command or Subagent picked, what the inspector reads for it, and when it opens.
function useWorkInspector({
  session,
  selectedSessionId,
  work,
  workReveal,
  feedSubagents,
}: {
  session: (Session & SessionExtras) | null
  selectedSessionId: string | null
  work: WorkSelection
  workReveal: ReturnType<typeof useWorkPick>['workReveal']
  feedSubagents: readonly FeedSubagent[]
}) {
  const subagents = sessionScreenSubagents(feedSubagents, session?.subagents ?? [])
  const shell = session?.shell?.find((command) => command.id === work.shellId) ?? null
  const delegation = pickedSubagent(subagents, work)
  const delegationFeed = useDelegationFeed(
    selectedSessionId,
    delegation?.id ?? null,
    delegation?.state === 'running',
  )
  const subagentUsage = useDelegationUsage(subagents.length === 0 ? null : selectedSessionId)
  const shellOutput = useShellOutput(
    selectedSessionId,
    shell?.id ?? null,
    shell?.state === 'running',
  )
  return {
    shell,
    delegation,
    delegationFeed: delegationFeed.feed,
    delegationFeedError: delegationFeed.feedError,
    retryDelegationFeed: delegationFeed.retry,
    subagentUsage,
    shellOutput,
    subagents,
    workReveal: workInspectorReveal(workReveal, shell, shellOutput),
  }
}

function useFeedJumpToLatestAction() {
  const [jumpToLatest, setJumpToLatest] = useState<{
    action: () => void
    sessionId: string
  } | null>(null)
  const onJumpToLatestChange = useCallback((sessionId: string, action: (() => void) | null) => {
    setJumpToLatest((current) => {
      if (action !== null) return { action, sessionId }
      return current?.sessionId === sessionId ? null : current
    })
  }, [])
  return { jumpToLatest: jumpToLatest?.action ?? null, onJumpToLatestChange }
}

// Opened evidence is held against its Session, since the Session screen stays mounted across a
// switch and evidence from one Session says nothing about the next.
function useSessionEvidence(sessionId: string | null) {
  const [opened, setOpened] = useState<{ sessionId: string | null; evidence: SessionEvidence }>()
  const setEvidence = useCallback(
    (evidence: SessionEvidence | null) =>
      setOpened(evidence === null ? undefined : { sessionId, evidence }),
    [sessionId],
  )
  return { evidence: opened?.sessionId === sessionId ? opened.evidence : null, setEvidence }
}

export function useSessionScreenModel() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { jumpToLatest, onJumpToLatestChange } = useFeedJumpToLatestAction()
  const [cockpit, projectActions] = useProjects()
  const [workspaceCockpit, workspaceActions] = useWorkspaces(cockpit.project?.id ?? null)
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const { evidence, setEvidence } = useSessionEvidence(selectedSessionId)
  const { work, pick, workReveal } = useWorkPick(selectedSessionId, () => setEvidence(null))
  const { session, loaded: sessionLoaded } = useSessionDetails(selectedSessionId)
  const feedRunning = sessionTurnRunning(session)
  const sessionFeed = useFeedReading(selectedSessionId, null, feedRunning)
  const [lastHarness, chooseHarness] = useState<Harness>(DEFAULT_HARNESS)
  const harness = sessionHarness({ selectedSessionId, lastHarness, chooseHarness, session })
  const permission = useSessionPermission(selectedSessionId)
  const question = useSessionQuestion(selectedSessionId)
  const inspector = useWorkInspector({
    session,
    selectedSessionId,
    work,
    workReveal,
    feedSubagents: sessionFeed.subagents,
  })
  return {
    jumpToLatest,
    onJumpToLatestChange,
    isNewSession: sessionId === 'new',
    selectedSessionId,
    ...sessionFeed,
    feedRunning,
    navigate,
    session,
    sessionLoaded,
    workspaceIdentity: sessionWorkspaceIdentity(session, workspaceCockpit.workspaces),
    evidence,
    setEvidence,
    harness,
    cockpit,
    projectActions,
    workspaceCockpit,
    workspaceActions,
    permission,
    question,
    work,
    pick,
    ...inspector,
  }
}

// A Turn the cockpit knows is in flight draws its current activity; every other Session, including
// one whose liveness is unknown, draws only what vendor history recorded.
function sessionTurnRunning(session: Session | null | undefined) {
  return session?.status === 'running' || session?.status === 'permission'
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
