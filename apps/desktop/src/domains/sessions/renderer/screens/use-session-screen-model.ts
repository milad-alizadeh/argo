// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure render
// surface the result.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
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
import type { SessionEvidence, SessionFeedRow } from '../types'
import { useWatchedQueries } from '../use-watched-topic'
import { mergeSessionFeed } from './merge-session-feed'
import { sessionHarness } from './session-screen-state'
import { sessionScreenSubagents } from './session-screen-subagents'
import { useWorkPick, type WorkSelection } from './work-selection'

const UNSELECTED_SESSION_ID = '00000000-0000-4000-8000-000000000000'

function useIndexedSessionFeed(selectedSessionId: string | null) {
  const sessionId = readableSessionId(selectedSessionId)
  const querySessionId = sessionId ?? UNSELECTED_SESSION_ID
  useWatchedQueries('session-live', [
    trpc.sessionFeed.queryKey({ sessionId: querySessionId, source: 'live' }),
  ])
  useWatchedQueries('sessions', [
    trpc.sessions.get.queryKey({ argoId: querySessionId }),
  ])
  const history = useQuery({
    ...trpc.sessionFeed.queryOptions({
      sessionId: querySessionId,
      source: 'history',
    }),
    enabled: sessionId !== null,
    refetchOnWindowFocus: true,
  })
  const live = useQuery({
    ...trpc.sessionFeed.queryOptions({ sessionId: querySessionId, source: 'live' }),
    enabled: sessionId !== null,
  })
  const wasLive = useRef(false)
  useEffect(() => {
    if (wasLive.current && live.data?.live === false) void history.refetch()
    wasLive.current = live.data?.live ?? false
  }, [history.refetch, live.data?.live])
  return {
    history,
    feed: sessionId === null ? null : mergeSessionFeed(history.data ?? null, live.data ?? null),
  }
}

function useIndexedSession(selectedSessionId: string | null) {
  const argoId = readableSessionId(selectedSessionId)
  return useQuery({
    ...trpc.sessions.get.queryOptions({
      argoId: argoId ?? UNSELECTED_SESSION_ID,
    }),
    enabled: argoId !== null,
  })
}

function useWorkArtifacts({
  work,
  feedRows,
}: {
  work: WorkSelection
  feedRows: readonly SessionFeedRow[]
}) {
  const subagents = sessionScreenSubagents(feedRows, [])
  const shell = null
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
    indexedSession: selected.data ?? null,
    availability: indexed.history.data?.availability ?? null,
    navigate,
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
