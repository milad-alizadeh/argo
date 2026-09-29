// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import type { FeedSubagent } from '@/domains/sessions/api/feed/feed-subagents'
import { useWorkspaces } from '@/domains/workspaces/renderer'
import { DEFAULT_HARNESS } from '@/harnesses/harness'
import { useSessionPermission } from '../composer/hooks/use-session-permission'
import { useSessionQuestion } from '../composer/hooks/use-session-question'
import { useFeedReading } from '../feed/use-feed-reading'
import type { SessionHarness } from '../harness/harnesses'
import { workInspectorReveal } from '../inspector/work-inspector-reveal'
import { useSessionList } from '../session-list/use-session-list'
import type { SessionEvidence } from '../types'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../work/use-session-work'
import { sessionHarness } from './session-screen-state'
import { sessionScreenSubagents } from './session-screen-subagents'
import { sessionWorkspaceIdentity } from './session-screen-workspace'
import { useSelectedSession } from './use-selected-session'
import { useWorkPick, type WorkSelection } from './work-selection'

function useWorkArtifacts({
  session,
  selectedSessionId,
  work,
  feedSubagents,
}: {
  session: ReturnType<typeof useSelectedSession>
  selectedSessionId: string | null
  work: WorkSelection
  feedSubagents: readonly FeedSubagent[]
}) {
  const subagents = sessionScreenSubagents(feedSubagents, session?.subagents ?? [])
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation = subagents.find((candidate) => candidate.id === work.subagentId) ?? null
  const delegationFeed = useDelegationFeed(selectedSessionId, delegation?.id ?? null)
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
  projectId: string | null,
  selectedSessionId: string | null,
  workspaces: ReturnType<typeof useWorkspaces>[0]['workspaces'],
) {
  const { sessionList } = useSessionList({ projectId })
  const session = useSelectedSession(selectedSessionId, sessionList)
  return {
    sessionList,
    session,
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
  session: ReturnType<typeof useSelectedSession>
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
  const [workspaceCockpit, workspaceActions] = useWorkspaces(cockpit.project?.id ?? null)
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const { evidence, setEvidence } = useSessionEvidence(selectedSessionId)
  const { work, pick, workReveal } = useWorkPick(selectedSessionId, () => setEvidence(null))
  const sessionFeed = useFeedReading(selectedSessionId)
  const { sessionList, session, workspaceIdentity } = useSessionSelectionData(
    cockpit.project?.id ?? null,
    selectedSessionId,
    workspaceCockpit.workspaces,
  )
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
    sessionList,
    navigate,
    session,
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

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
