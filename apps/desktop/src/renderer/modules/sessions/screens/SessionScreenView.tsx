import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { useProjects } from '../../projects/hooks/useProjects'
import { COMPOSER_FOCUS_STATE } from '../components/SessionComposer'
import { SessionEvidenceInspector } from '../components/SessionEvidenceInspector'
import { SessionComposerArea, SessionWorkInspector } from '../components/SessionScreenDetails'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessionPermission } from '../hooks/useSessionPermission'
import { useSessionQuestion } from '../hooks/useSessionQuestion'
import { useSessions } from '../hooks/useSessions'
import { useComposerStore } from '../state/useComposerStore'
import type { SessionFeed, SessionFeedRow } from '../types'
import { SessionShell } from './SessionShell'
import { sessionHarness, sessionHasWork } from './sessionScreenState'

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
  const session = roster?.sessions.find(({ id }) => id === selectedSessionId) ?? null
  const [evidence, setEvidence] = useState<Extract<SessionFeedRow, { shape: 'tool' }> | null>(null)
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
    session,
    evidence,
    setEvidence,
    harness,
    composer,
    permission,
    question,
  }
}

export function SessionScreenView() {
  const {
    selectedSessionId,
    feed,
    feedError,
    session,
    evidence,
    setEvidence,
    harness,
    composer,
    permission,
    question,
  } = useSessionScreenModel()
  const hasSessionWork = sessionHasWork(session)
  return (
    <SessionShell
      feed={feed}
      feedError={feedError}
      compactionStartedAt={session?.compactionStartedAt ?? null}
      compactionPercentage={session?.compactionPercentage ?? null}
      compactionTokens={session?.compactionTokens ?? null}
      isRunning={session?.status === 'running'}
      selectedSessionId={selectedSessionId}
      activeEvidenceId={evidence?.id ?? null}
      onOpenEvidence={setEvidence}
      onAnswerQuestion={(_sessionId, questionId, answers) =>
        void question.decide(questionId, answers)
      }
      answeringQuestionId={question.answeringId}
      questionFailure={question.failureFor}
      composer={
        <SessionComposerArea
          composer={composer}
          permission={permission}
          questionPending={pendingQuestionId(feed) !== null}
          session={session}
          harness={harness}
        />
      }
      inspector={
        evidence === null ? (
          <SessionWorkInspector session={session} />
        ) : (
          <SessionEvidenceInspector evidence={evidence} />
        )
      }
      defaultInspectorCollapsed={!hasSessionWork}
      inspectorReveal={evidence?.id}
    />
  )
}
