import { useState } from 'react'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import type { FeedLiveFacts } from '../feed/document/feed-live-facts'
import { BackgroundWork } from '../feed/rows/background-work'
import { SessionInspector } from '../inspector/session-inspector'
import type { SessionFeed } from '../types'
import { SessionWorkButtons } from '../work/session-work-buttons'
import { SessionWorkInspectorHeader } from '../work/session-work-inspector-header'
import { backgroundWorkLinks } from './background-work-links'
import { SessionComposerArea, SessionHandoffFacts } from './session-screen-details'
import { SessionShell } from './session-shell'
import { suppressMissingSessionFailure as isMissingSessionFailureSuppressed } from './suppress-missing-session-failure'
import { type SessionScreenModel, useSessionScreenModel } from './use-session-screen-model'

// An unanswered ask row, if the Feed is currently showing one.
function pendingQuestionId(feed: SessionFeed | null): string | null {
  const row = feed?.rows.find((row) => row.shape === 'ask' && row.answer === null)
  return row?.id ?? null
}

function WorkButtons({ model }: { model: SessionScreenModel }) {
  const { pick, selectedSessionId, session, work } = model
  return (
    <SessionWorkButtons
      subagents={session?.subagents ?? []}
      subagentUsage={model.subagentUsage}
      onSelectDelegation={(subagentId) =>
        pick({ sessionId: selectedSessionId, subagentId, shellId: null })
      }
      onSelectShell={(shellId) => pick({ sessionId: selectedSessionId, subagentId: null, shellId })}
      selectedDelegationId={work.subagentId}
      selectedShellId={work.shellId}
      shell={session?.shell ?? []}
    />
  )
}

function Inspector({ model }: { model: SessionScreenModel }) {
  const { evidence, navigate, roster, session, setEvidence } = model
  return (
    <SessionInspector
      activeEvidenceId={evidence?.id ?? null}
      delegation={model.delegation}
      delegationFeed={model.delegationFeed}
      delegationFeedError={model.delegationFeedError}
      evidence={evidence}
      sessionId={model.selectedSessionId}
      handoff={<SessionHandoffFacts onNavigate={navigate} roster={roster} session={session} />}
      onOpenEvidence={setEvidence}
      onOpenSession={(sessionId) => navigate(`/sessions/${sessionId}`)}
      onRetryDelegationFeed={model.retryDelegationFeed}
      shell={model.shell}
      shellOutput={model.shellOutput}
    />
  )
}

function InspectorBar({ model }: { model: SessionScreenModel }) {
  if (model.evidence !== null) return null
  if (model.shell !== null && model.shellOutput?.state === 'available') {
    return <SessionWorkInspectorHeader work={{ kind: 'shell', command: model.shell }} />
  }
  if (model.delegation !== null) {
    return (
      <SessionWorkInspectorHeader
        work={{
          kind: 'delegation',
          delegation: model.delegation,
          usage: model.subagentUsage[model.delegation.id] ?? { tokens: null, model: null },
        }}
      />
    )
  }
  return null
}

function liveFactsOf({ composer, session }: SessionScreenModel): NonNullable<FeedLiveFacts> {
  return {
    compactionStartedAt: session?.compactionStartedAt ?? null,
    compactionPercentage: session?.compactionPercentage ?? null,
    compactionTokens: session?.compactionTokens ?? null,
    handoffStartedAt: session?.handoffStartedAt ?? null,
    handoffTo: session?.handoffTo ?? null,
    isRunning: session?.status === 'running' || session?.status === 'permission',
    status: session?.status ?? null,
    activity: session?.activity ?? null,
    optimisticRow: composer.optimisticRow,
    settledPromptRow: composer.settledPromptRow,
    posture: session?.posture ?? null,
    turnMarker: composer.markerView,
  }
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { evidence, feed, feedError, isNewSession, question, session } = model
  const { navigate, retryFeed, selectedSessionId, setEvidence, workReveal } = model
  const [feedStalledSessionId, setFeedStalledSessionId] = useState<string | null>(null)
  const failure = model.composer.failure
  const suppressFailure = isMissingSessionFailureSuppressed({
    failure,
    feedFailed: feedError !== null,
    feedStalledSessionId,
    selectedSessionId,
  })
  const openSession = (sessionId: string) => navigate(`/sessions/${sessionId}`)
  const answerQuestion = (_sessionId: string, questionId: string, answers: QuestionAnswer[]) =>
    void question.decide(questionId, answers)
  return (
    <BackgroundWork.Provider value={backgroundWorkLinks(model)}>
      <SessionShell
        feed={feed}
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
        onFeedStalledChange={setFeedStalledSessionId}
        composer={
          selectedSessionId === null && !isNewSession ? null : (
            <SessionComposerArea
              composer={model.composer}
              permission={model.permission}
              questionPending={pendingQuestionId(feed) !== null}
              session={session}
              harness={model.harness}
              suppressMissingSessionFailure={suppressFailure}
            />
          )
        }
        headerControls={<WorkButtons model={model} />}
        session={session}
        inspector={<Inspector model={model} />}
        inspectorBar={<InspectorBar model={model} />}
        defaultInspectorCollapsed={true}
        // Picking work in the header opens the inspector, the way opening recorded evidence does.
        // Nothing opens it on its own any more: the header buttons are what say a Session has
        // background work (#1582 AC1).
        inspectorReveal={evidence?.id ?? workReveal ?? undefined}
      />
    </BackgroundWork.Provider>
  )
}
