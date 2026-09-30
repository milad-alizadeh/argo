// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import type { FeedSubagent } from '@/domains/sessions/api/feed'
import { useWorkspaces } from '@/domains/workspaces/renderer'
import { DEFAULT_HARNESS } from '@/harnesses/harness'
import { useSessionPermission, useSessionQuestion } from '../composer'
import { useFeedReading } from '../feed'
import type { SessionHarness } from '../harness'
import { workInspectorReveal } from '../inspector'
import type { SessionStatus } from '../model'
import type { Session, SessionEvidence } from '../types'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../work'
import { sessionHarness } from './session-screen-state'
import { pickedSubagent, sessionScreenSubagents } from './session-screen-subagents'
import { sessionWorkspaceIdentity } from './session-screen-workspace'
import { useSessionDetails } from './use-session-details'
import { useWorkPick, type WorkSelection } from './work-selection'

function useWorkArtifacts({
  session,
  selectedSessionId,
  work,
  feedSubagents,
}: {
  session: Session | null
  selectedSessionId: string | null
  work: WorkSelection
  feedSubagents: readonly FeedSubagent[]
}) {
  const subagents = sessionScreenSubagents(feedSubagents, session?.subagents ?? [])
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation = pickedSubagent(subagents, work)
  const delegationFeed = useDelegationFeed(
    selectedSessionId,
    delegation?.id ?? null,
    delegation?.state === 'running',
  )
  return {
    shell,
    delegation,
    delegationFeed: delegationFeed.feed,
    delegationFeedError: delegationFeed.feedError,
    retryDelegationFeed: delegationFeed.retry,
    subagentUsage: useDelegationUsage(subagents.length === 0 ? null : selectedSessionId),
    shellOutput: useShellOutput(selectedSessionId, shell?.id ?? null, shell?.state === 'running'),
    subagents,
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

function useSessionSelectionData(
  selectedSessionId: string | null,
  workspaces: ReturnType<typeof useWorkspaces>[0]['workspaces'],
) {
  const { session, loaded } = useSessionDetails(selectedSessionId)
  return {
    session,
    sessionLoaded: loaded,
    workspaceIdentity: sessionWorkspaceIdentity(session, workspaces),
  }
}

function useSessionInteractions(selectedSessionId: string | null) {
  // Ask only real Session ids; an optimistic Session row has no backend record yet (#2109).
  return {
    permission: useSessionPermission(selectedSessionId),
    question: useSessionQuestion(selectedSessionId),
  }
}

function useSessionInspectorData({
  session,
  selectedSessionId,
  work,
  workReveal,
  feedSubagents,
}: {
  session: Session | null
  selectedSessionId: string | null
  work: WorkSelection
  workReveal: ReturnType<typeof useWorkPick>['workReveal']
  feedSubagents: readonly FeedSubagent[]
}) {
  const artifacts = useWorkArtifacts({ session, selectedSessionId, work, feedSubagents })
  return {
    ...artifacts,
    workReveal: workInspectorReveal(workReveal, artifacts.shell, artifacts.shellOutput),
  }
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
  const { projectId, sessionId } = useParams()
  const navigate = useNavigate()
  const { jumpToLatest, onJumpToLatestChange } = useFeedJumpToLatestAction()
  const [cockpit, projectActions] = useProjects()
  const selectedProjectId = cockpit.project?.id ?? projectId ?? null
  const [workspaceCockpit, workspaceActions] = useWorkspaces(selectedProjectId)
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const { evidence, setEvidence } = useSessionEvidence(selectedSessionId)
  const { work, pick, workReveal } = useWorkPick(selectedSessionId, () => setEvidence(null))
  const { session, sessionLoaded, workspaceIdentity } = useSessionSelectionData(
    selectedSessionId,
    workspaceCockpit.workspaces,
  )
  const feedRunning = sessionTurnRunning(session)
  const sessionFeed = useFeedReading(selectedSessionId, null, feedRunning)
  const [lastHarness, chooseHarness] = useState<SessionHarness>(DEFAULT_HARNESS)
  const harness = sessionHarness({ selectedSessionId, lastHarness, chooseHarness, session })
  const { permission, question } = useSessionInteractions(selectedSessionId)
  const inspector = useSessionInspectorData({
    session,
    selectedSessionId,
    work,
    workReveal,
    feedSubagents: sessionFeed.subagents,
  })
  return {
    projectId,
    jumpToLatest,
    onJumpToLatestChange,
    isNewSession: sessionId === 'new',
    selectedSessionId,
    ...sessionFeed,
    feedRunning,
    navigate,
    session,
    sessionLoaded,
    workspaceIdentity,
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
const TURN_RUNNING: Record<SessionStatus, boolean> = {
  running: true,
  permission: true,
  starting: false,
  asking: false,
  unknown: false,
  idle: false,
  stopped: false,
  ended: false,
}

function sessionTurnRunning(session: Session | null | undefined) {
  return session === null || session === undefined ? false : TURN_RUNNING[session.status]
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
