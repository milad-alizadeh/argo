// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import type { FeedSubagent } from '@/domains/sessions/api/feed'
import { DEFAULT_HARNESS, type Harness } from '@/harnesses/harness'
import { useSessionPermission, useSessionQuestion, useWorktreeOptions } from '../composer'
import { isFeedRowPrompt, useFeedReading } from '../feed'
import { useAvailableHarnesses } from '../harness'
import { workInspectorReveal } from '../inspector'
import type { Session, SessionEvidence, SessionExtras } from '../types'
import { useDelegationFeed, useDelegationUsage, useShellOutput } from '../work'
import { sessionLocation } from './session-screen-location'
import { sessionHarness } from './session-screen-state'
import { pickedSubagent, sessionScreenSubagents } from './session-screen-subagents'
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
  // #2970 fills the shell commands.
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

// The Session's Feed. A new Session's pending id draws on New Session from Enter, then on the
// Session it was named until that Session's own Feed shows a prompt, whatever the Harness. New
// Session keeps it across the naming render only.
function useSessionFeed(selectedSessionId: string | null, running: boolean) {
  const { projectId, sessionId } = useParams()
  const [starting, setStarting] = useState<{
    projectId: string | undefined
    pendingId: string
    sessionId: string
  } | null>(null)
  const onStartingSession = useCallback(
    (pendingId: string | null, named = 'new') =>
      setStarting(pendingId === null ? null : { projectId, pendingId, sessionId: named }),
    [projectId],
  )
  // A move to any route but the named Session drops the start, so New Session draws no old prompt.
  const route = `${projectId}/${sessionId}`
  const [seenRoute, setSeenRoute] = useState(route)
  if (seenRoute !== route) {
    setSeenRoute(route)
    if (starting !== null && sessionId !== starting.sessionId) setStarting(null)
  }
  const shown =
    starting !== null &&
    starting.projectId === projectId &&
    (sessionId === 'new' || sessionId === starting.sessionId)
  const startingSessionId = shown ? starting.pendingId : null
  const startingFeed = useFeedReading(startingSessionId)
  const namedFeed = useFeedReading(selectedSessionId, null, running)
  const holdsPrompt = startingFeed.feed !== null && !namedFeed.feed?.rows.some(isFeedRowPrompt)
  return {
    ...(holdsPrompt ? startingFeed : namedFeed),
    feedSessionId: holdsPrompt ? startingSessionId : selectedSessionId,
    onStartingSession,
  }
}

export function useSessionScreenModel() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { jumpToLatest, onJumpToLatestChange } = useFeedJumpToLatestAction()
  const [projectState, projectActions] = useProjects()
  const [worktreeState, worktreeActions] = useWorktreeOptions(projectState.project?.id ?? null)
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const { evidence, setEvidence } = useSessionEvidence(selectedSessionId)
  const { work, pick, workReveal } = useWorkPick(selectedSessionId, () => setEvidence(null))
  const { session, loaded: sessionLoaded } = useSessionDetails(selectedSessionId)
  const feedRunning = sessionTurnRunning(session)
  const sessionFeed = useSessionFeed(selectedSessionId, feedRunning)
  const [pickedHarness, chooseHarness] = useState<Harness | null>(null)
  const availableHarnesses = useAvailableHarnesses()
  const lastHarness = pickedHarness ?? availableHarnesses?.[0] ?? DEFAULT_HARNESS
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
    location: sessionLocation(session, worktreeState.options?.checkout ?? null),
    evidence,
    setEvidence,
    harness,
    projectState,
    projectActions,
    worktreeState,
    worktreeActions,
    permission,
    question,
    work,
    pick,
    ...inspector,
  }
}

// A Turn the app recognizes as in flight draws its current activity; every other Session, including
// one whose liveness is unknown, draws only what vendor history recorded.
function sessionTurnRunning(session: Session | null | undefined) {
  return session?.status === 'running' || session?.status === 'permission'
}

export type SessionScreenModel = ReturnType<typeof useSessionScreenModel>
