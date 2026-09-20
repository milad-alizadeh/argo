import type { QuestionAnswer } from '@/domains/sessions/contract/question'
import { BackgroundWork } from '@/domains/sessions/renderer/feed/background-work'
import type { FeedLiveFacts } from '@/domains/sessions/renderer/feed/feed-live-facts'
import { SessionInspector } from '@/domains/sessions/renderer/inspector/session-inspector'
import { backgroundWorkLinks } from '@/domains/sessions/renderer/screens/background-work-links'
import {
  SessionComposerArea,
  SessionHandoffFacts,
} from '@/domains/sessions/renderer/screens/session-screen-details'
import { SessionShell } from '@/domains/sessions/renderer/screens/session-shell'
import {
  type SessionScreenModel,
  useSessionScreenModel,
} from '@/domains/sessions/renderer/screens/use-session-screen-model'
import type { SessionFeed } from '@/domains/sessions/renderer/types'
import { SessionWorkButtons } from '@/domains/sessions/renderer/work/session-work-buttons'
import { SessionWorkInspectorHeader } from '@/domains/sessions/renderer/work/session-work-inspector-header'

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
      evidence={evidence}
      sessionId={model.selectedSessionId}
      handoff={<SessionHandoffFacts onNavigate={navigate} roster={roster} session={session} />}
      onOpenEvidence={setEvidence}
      onOpenSession={(sessionId) => navigate(`/sessions/${sessionId}`)}
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
    activity: session?.activity ?? null,
    optimisticRow: composer.optimisticRow,
    settledPromptRow: composer.settledPromptRow,
    posture: session?.posture ?? null,
    turnMarker: composer.markerView,
  }
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { evidence, feed, feedError, question, session } = model
  const { navigate, retryFeed, selectedSessionId, setEvidence, workReveal } = model
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
        composer={
          selectedSessionId === null ? null : (
            <SessionComposerArea
              composer={model.composer}
              permission={model.permission}
              questionPending={pendingQuestionId(feed) !== null}
              session={session}
              harness={model.harness}
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
