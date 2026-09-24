import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import type { FeedLiveFacts } from '../feed/document/feed-live-facts'
import { BackgroundWork } from '../feed/rows/background-work'
import { SessionInspector } from '../inspector/session-inspector'
import type { SessionFeed } from '../types'
import { backgroundWorkLinks } from './background-work-links'
import { SessionComposerArea } from './session-screen-details'
import { SessionShell } from './session-shell'
import { type SessionScreenModel, useSessionScreenModel } from './use-session-screen-model'

// An unanswered ask row, if the Feed is currently showing one.
function pendingQuestionId(feed: SessionFeed | null): string | null {
  const row = feed?.rows.find((row) => row.shape === 'ask' && row.answer === null)
  return row?.id ?? null
}

function Inspector({ model }: { model: SessionScreenModel }) {
  const { evidence, navigate, setEvidence } = model
  return (
    <SessionInspector
      activeEvidenceId={evidence?.id ?? null}
      delegation={null}
      delegationFeed={null}
      delegationFeedError={null}
      evidence={evidence}
      sessionId={model.selectedSessionId}
      handoff={null}
      onOpenEvidence={setEvidence}
      onOpenSession={(sessionId) => navigate(`/sessions/${sessionId}`)}
      onRetryDelegationFeed={() => {}}
      shell={null}
      shellOutput={null}
    />
  )
}

function InspectorBar() {
  return null
}

function liveFactsOf({ feed }: SessionScreenModel): NonNullable<FeedLiveFacts> {
  const live = feed?.live ?? false
  let status: 'running' | 'idle' | null = null
  if (feed?.working) status = 'running'
  else if (live) status = 'idle'
  return {
    compactionStartedAt: null,
    compactionPercentage: null,
    compactionTokens: null,
    handoffStartedAt: null,
    handoffTo: null,
    isRunning: feed?.working ?? false,
    status,
    activity: null,
    optimisticRow: null,
    settledPromptRow: null,
    posture: live ? 'managed' : null,
    turnMarker: null,
  }
}

function indexedTitle({ indexedSession }: SessionScreenModel): string | null {
  return (
    indexedSession?.argoTitle ??
    indexedSession?.vendorTitle ??
    indexedSession?.firstPrompt ??
    indexedSession?.nativeId ??
    null
  )
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { evidence, feed, feedError, isNewSession, question } = model
  const { navigate, retryFeed, selectedSessionId, setEvidence } = model
  const openSession = (sessionId: string) => navigate(`/sessions/${sessionId}`)
  const answerQuestion = (_sessionId: string, questionId: string, answers: QuestionAnswer[]) =>
    void question.decide(questionId, answers)
  return (
    <BackgroundWork.Provider value={backgroundWorkLinks(model)}>
      <SessionShell
        feed={feed}
        headerTitle={indexedTitle(model)}
        headerWorkingDirectory={model.indexedSession?.workingDirectory ?? null}
        feedError={feedError}
        onRetryFeed={retryFeed}
        liveFacts={liveFactsOf(model)}
        onOpenSession={openSession}
        selectedSessionId={selectedSessionId}
        activeEvidenceId={evidence?.id ?? null}
        onOpenEvidence={setEvidence}
        onAnswerQuestion={answerQuestion}
        answeringQuestionId={model.question.answeringId}
        questionFailure={model.question.failureFor}
        composer={
          (selectedSessionId === null && !isNewSession) ||
          feedError?.code === 'missing-session' ? null : (
            <SessionComposerArea
              permission={model.permission}
              indexedSession={model.indexedSession}
              availability={model.availability}
              retryAvailability={retryFeed}
              questionPending={pendingQuestionId(feed) !== null}
              harness={model.harness}
              selectedSessionId={selectedSessionId}
              cockpit={model.cockpit}
              projectActions={model.projectActions}
            />
          )
        }
        inspector={<Inspector model={model} />}
        inspectorBar={<InspectorBar />}
        defaultInspectorCollapsed={true}
        inspectorReveal={evidence?.id ?? undefined}
      />
    </BackgroundWork.Provider>
  )
}
