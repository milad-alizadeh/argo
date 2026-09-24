// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import type { SubagentUsageFacts } from '@/domains/sessions/contract/model/wire/background-work-contract'
import { trpc } from '@/platform/renderer/trpc-client'
import { useComposerStore } from '../composer/hooks/use-composer-store'
import { useSessionPermission } from '../composer/hooks/use-session-permission'
import { useSessionQuestion } from '../composer/hooks/use-session-question'
import { indexedSessionFeed } from '../indexed-session-feed'
import { workInspectorReveal } from '../inspector/work-inspector-reveal'
import type { SessionContractError } from '../session-contract-error'
import { readableSessionId } from '../session-creation'
import type { Session, SessionEvidence, SessionFeed, SessionFeedRow, SessionRoster } from '../types'
import { sessionHarness } from './session-screen-state'
import { sessionScreenSubagents } from './session-screen-subagents'
import { useWorkPick, type WorkSelection } from './work-selection'

function useScreenSessionFeed(): {
  feed: SessionFeed | null
  feedError: SessionContractError | null
  retryFeed: () => void
  roster: SessionRoster | null
} {
  return {
    feed: null,
    feedError: null,
    retryFeed: (): void => {},
    roster: null,
  }
}

function useIndexedSessionFeed(selectedSessionId: string | null) {
  const sessionId = readableSessionId(selectedSessionId)
  const history = useQuery({
    ...trpc.sessionFeed.queryOptions({
      sessionId: sessionId ?? '00000000-0000-4000-8000-000000000000',
    }),
    enabled: sessionId !== null,
    refetchInterval: 2_000,
    refetchOnWindowFocus: true,
  })
  return {
    history,
    feed: indexedSessionFeed(sessionId, history.data),
  }
}

function useWorkArtifacts({
  session,
  work,
  feedRows,
}: {
  session: Session | null
  work: WorkSelection
  feedRows: readonly SessionFeedRow[]
}) {
  const subagents = sessionScreenSubagents(feedRows, session?.subagents ?? [])
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegation = subagents.find((candidate) => candidate.id === work.subagentId) ?? null
  return {
    shell,
    delegation,
    delegationFeed: null,
    delegationFeedError: null,
    retryDelegationFeed: (): void => {},
    subagentUsage: {} as Record<string, SubagentUsageFacts>,
    shellOutput: null,
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
  const { feed, feedError, roster, retryFeed } = useScreenSessionFeed()
  const indexed = useIndexedSessionFeed(selectedSessionId)
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = null as Session | null
  const indexedIdentity =
    indexed.history.data === undefined ? null : { harness: indexed.history.data.harness }
  const harness = sessionHarness({
    selectedSessionId,
    lastHarness,
    chooseHarness,
    session: indexedIdentity,
  })
  const permission = useSessionPermission(readableSessionId(selectedSessionId))
  const question = useSessionQuestion(readableSessionId(selectedSessionId))
  const artifacts = useWorkArtifacts({
    session: session as Session | null,
    work,
    feedRows: feed?.rows ?? [],
  })
  const inspectorReveal = workInspectorReveal(workReveal, artifacts.shell, artifacts.shellOutput)
  return {
    isNewSession: sessionId === 'new',
    selectedSessionId,
    feed: indexed.feed ?? feed,
    feedError: indexed.feed === null ? feedError : null,
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
