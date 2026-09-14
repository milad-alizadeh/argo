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
import type { SessionRoster } from '../hooks/useSessions'
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

// The Inspector shows one Evidence at a time in place of the Session's own facts, never both.
function SessionInspectorPane({
  evidence,
  session,
  roster,
  navigate,
}: {
  evidence: SessionEvidence | null
  session: Parameters<typeof SessionWorkInspector>[0]['session']
  roster: SessionRoster
  navigate: (path: string) => void
}) {
  if (evidence !== null) return <SessionEvidenceInspector evidence={evidence} />
  return (
    <>
      <SessionWorkInspector session={session} />
      <SessionHandoffFacts session={session} roster={roster} onNavigate={navigate} />
    </>
  )
}

// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure
// render surface the result.
function useSessionScreenModel() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const { feed, feedError, roster, retryFeed } = useSessions(selectedSessionId)
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
  const openSession = (sessionId: string) => navigate(`/sessions/${sessionId}`)
  const answerQuestion = (
    _sessionId: string,
    questionId: string,
    answers: ClaudeQuestionAnswer[],
  ) => void question.decide(questionId, answers)
  return {
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
    openSession,
    answerQuestion,
  }
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { session, evidence, feed } = model
  return (
    <SessionShell
      feed={feed}
      feedError={model.feedError}
      onRetryFeed={model.retryFeed}
      compactionStartedAt={session?.compactionStartedAt ?? null}
      compactionPercentage={session?.compactionPercentage ?? null}
      compactionTokens={session?.compactionTokens ?? null}
      handoffStartedAt={session?.handoffStartedAt ?? null}
      handoffTo={session?.handoffTo ?? null}
      onOpenSession={model.openSession}
      isRunning={session?.status === 'running'}
      posture={session?.posture ?? null}
      selectedSessionId={model.selectedSessionId}
      activeEvidenceId={evidence?.id ?? null}
      onOpenEvidence={model.setEvidence}
      onAnswerQuestion={model.answerQuestion}
      answeringQuestionId={model.question.answeringId}
      questionFailure={model.question.failureFor}
      composer={
        <SessionComposerArea
          composer={model.composer}
          permission={model.permission}
          questionPending={pendingQuestionId(feed) !== null}
          session={session}
          harness={model.harness}
        />
      }
      inspector={
        <SessionInspectorPane
          evidence={evidence}
          session={session}
          roster={model.roster}
          navigate={model.navigate}
        />
      }
      defaultInspectorCollapsed={!sessionHasWork(session)}
      inspectorReveal={evidence?.id}
    />
  )
}
