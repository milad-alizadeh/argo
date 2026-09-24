// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { useProjects } from '@/domains/projects/renderer'
import type { SubagentUsageFacts } from '@/domains/sessions/contract/model/wire/background-work-contract'
import { sessionError } from '@/domains/sessions/contract/session-error'
import { trpc } from '@/platform/renderer/trpc-client'
import { useComposerStore } from '../composer/hooks/use-composer-store'
import { useSessionPermission } from '../composer/hooks/use-session-permission'
import { useSessionQuestion } from '../composer/hooks/use-session-question'
import { workInspectorReveal } from '../inspector/work-inspector-reveal'
import { SessionContractError as SessionReadError } from '../session-contract-error'
import { readableSessionId } from '../session-creation'
import type { Session, SessionEvidence, SessionFeedRow, SessionRoster } from '../types'
import { useWatchedQueries } from '../use-watched-topic'
import { sessionHarness } from './session-screen-state'
import { sessionScreenSubagents } from './session-screen-subagents'
import { useWorkPick, type WorkSelection } from './work-selection'

function useIndexedSessionFeed(selectedSessionId: string | null) {
  const sessionId = readableSessionId(selectedSessionId)
  useWatchedQueries('sessions', [
    trpc.sessionFeed.queryKey({ sessionId: sessionId ?? '00000000-0000-4000-8000-000000000000' }),
    trpc.sessions.get.queryKey({ argoId: sessionId ?? '00000000-0000-4000-8000-000000000000' }),
  ])
  const history = useQuery({
    ...trpc.sessionFeed.queryOptions({
      sessionId: sessionId ?? '00000000-0000-4000-8000-000000000000',
    }),
    enabled: sessionId !== null,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.live ? 1_000 : false),
  })
  return {
    history,
    feed: sessionId === null ? null : (history.data ?? null),
  }
}

function useIndexedSession(selectedSessionId: string | null) {
  const argoId = readableSessionId(selectedSessionId)
  return useQuery({
    ...trpc.sessions.get.queryOptions({
      argoId: argoId ?? '00000000-0000-4000-8000-000000000000',
    }),
    enabled: argoId !== null,
  })
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
  const indexed = useIndexedSessionFeed(selectedSessionId)
  const readableId = readableSessionId(selectedSessionId)
  const selected = useIndexedSession(selectedSessionId)
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = null as Session | null
  const indexedIdentity = selected.data ?? indexed.history.data ?? null
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
    feedRows: indexed.feed?.rows ?? [],
  })
  const inspectorReveal = workInspectorReveal(workReveal, artifacts.shell, artifacts.shellOutput)
  return {
    isNewSession: sessionId === 'new',
    selectedSessionId,
    feed: indexed.feed,
    feedError:
      indexed.history.isError && readableId !== null
        ? new SessionReadError(sessionError('vendor-history-unavailable', readableId))
        : null,
    retryFeed: () => void indexed.history.refetch(),
    roster: null as SessionRoster | null,
    indexedSession: selected.data ?? null,
    availability: indexed.history.data?.availability ?? null,
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
