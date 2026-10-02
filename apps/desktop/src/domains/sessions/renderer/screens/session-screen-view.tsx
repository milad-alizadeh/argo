import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import { BackgroundWork } from '../feed'
import { SessionInspector } from '../inspector'
import { SessionWorkButtons, SessionWorkInspectorHeader } from '../work'
import { backgroundWorkLinks } from './background-work-links'
import { SessionComposerArea, SessionHandoffFacts } from './session-screen-details'
import { SessionShell } from './session-shell'
import { type SessionScreenModel, useSessionScreenModel } from './use-session-screen-model'

function WorkButtons({ model }: { model: SessionScreenModel }) {
  const { pick, selectedSessionId, session, work } = model
  return (
    <SessionWorkButtons
      subagents={model.subagents}
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
  const { evidence, navigate, session, setEvidence } = model
  return (
    <SessionInspector
      activeEvidenceId={evidence?.id ?? null}
      delegation={model.delegation}
      delegationFeed={model.delegationFeed}
      delegationFeedError={model.delegationFeedError}
      evidence={evidence}
      sessionId={model.selectedSessionId}
      handoff={<SessionHandoffFacts onNavigate={navigate} session={session} />}
      onOpenEvidence={setEvidence}
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

function composerFor(model: ReturnType<typeof useSessionScreenModel>) {
  if (
    (model.selectedSessionId === null && !model.isNewSession) ||
    model.feedError?.code === 'missing-session'
  )
    return null
  return (
    <SessionComposerArea
      permission={model.permission}
      questionPending={model.session?.posture === 'live' && model.pendingQuestionId !== null}
      liveStatus={model.liveStatus}
      session={model.session}
      harness={model.harness}
      selectedSessionId={model.selectedSessionId}
      sessionLoaded={model.sessionLoaded}
      sent={model.sent}
      projectState={model.projectState}
      worktreeActions={model.worktreeActions}
      worktreeState={model.worktreeState}
      onStartingSession={model.onStartingSession}
    />
  )
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { evidence, feed, feedError, question, session } = model
  const { retryFeed, setEvidence, workReveal } = model
  const answerQuestion = (_sessionId: string, questionId: string, answers: QuestionAnswer[]) =>
    void question.decide(questionId, answers)
  return (
    <BackgroundWork.Provider value={backgroundWorkLinks(model)}>
      <SessionShell
        feed={feed}
        feedError={feedError}
        onRetryFeed={retryFeed}
        running={model.feedRunning}
        posture={session?.posture ?? null}
        selectedSessionId={model.feedSessionId}
        activeEvidenceId={evidence?.id ?? null}
        onOpenEvidence={setEvidence}
        onAnswerQuestion={answerQuestion}
        answeringQuestionId={model.question.answeringId}
        questionFailure={model.question.failureFor}
        jumpToLatest={model.jumpToLatest}
        onJumpToLatestChange={model.onJumpToLatestChange}
        composer={composerFor(model)}
        headerControls={<WorkButtons model={model} />}
        session={session}
        location={model.location}
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
