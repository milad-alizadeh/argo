import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import { useProjects } from '../../projects/hooks/useProjects'
import { SessionEvidenceInspector } from '../components/SessionEvidenceInspector'
import {
  SessionComposerArea,
  SessionHandoffFacts,
  SessionWorkInspector,
} from '../components/SessionScreenDetails'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessionPermission } from '../hooks/useSessionPermission'
import { useSessionQuestion } from '../hooks/useSessionQuestion'
import { useSessions } from '../hooks/useSessions'
import { useComposerStore } from '../state/useComposerStore'
import type { SessionEvidence, SessionFeed } from '../types'
import { SessionShell } from './SessionShell'
import { sessionHarness, sessionHasWork } from './sessionScreenState'
import { useSelectedSession } from './useSelectedSession'

// An unanswered `AskUserQuestion` tool call, if the Feed is currently showing one.
function pendingQuestionId(feed: SessionFeed | null): string | null {
  const row = feed?.rows.find((row) => row.shape === 'ask' && row.answer === null)
  return row?.id ?? null
}

// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure
// render surface the result.
function useSessionScreenModel() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
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
  }
}

function sessionShellProps(model: ReturnType<typeof useSessionScreenModel>) {
  const { selectedSessionId, feed, feedError, roster, navigate, session, evidence, question } =
    model
  return {
    feed,
    feedError,
    compactionStartedAt: session?.compactionStartedAt ?? null,
    compactionPercentage: session?.compactionPercentage ?? null,
    compactionTokens: session?.compactionTokens ?? null,
    handoffStartedAt: session?.handoffStartedAt ?? null,
    handoffTo: session?.handoffTo ?? null,
    onOpenSession: (sessionId: string) => navigate(`/sessions/${sessionId}`),
    isRunning: session?.status === 'running',
    optimisticRow: model.composer.optimisticRow,
    turnMarker: model.composer.markerView,
    selectedSessionId,
    activeEvidenceId: evidence?.id ?? null,
    onOpenEvidence: model.setEvidence,
    onAnswerQuestion: (_sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) =>
      void question.decide(questionId, answers),
    answeringQuestionId: question.answeringId,
    questionFailure: question.failureFor,
    defaultInspectorCollapsed: !sessionHasWork(session),
    inspectorReveal: evidence?.id,
    roster,
  }
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { evidence, session, harness, composer, permission, feed, roster, navigate } = model
  const composerArea = (
    <SessionComposerArea
      composer={composer}
      permission={permission}
      questionPending={pendingQuestionId(feed) !== null}
      session={session}
      harness={harness}
    />
  )
  const inspectorArea =
    evidence === null ? (
      <>
        <SessionWorkInspector session={session} />
        <SessionHandoffFacts session={session} roster={roster} onNavigate={navigate} />
      </>
    ) : (
      <SessionEvidenceInspector evidence={evidence} />
    )
  return (
    <SessionShell {...sessionShellProps(model)} composer={composerArea} inspector={inspectorArea} />
  )
}
