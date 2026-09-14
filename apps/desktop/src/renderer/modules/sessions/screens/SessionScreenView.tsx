import { SessionInspector } from '../components/SessionInspector'
import { SessionComposerArea, SessionHandoffFacts } from '../components/SessionScreenDetails'
import { SessionWorkButtons } from '../components/SessionWorkButtons'
import type { SessionFeed } from '../types'
import { SessionShell } from './SessionShell'
import { type SessionScreenModel, useSessionScreenModel } from './useSessionScreenModel'

// An unanswered `AskUserQuestion` tool call, if the Feed is currently showing one.
function pendingQuestionId(feed: SessionFeed | null): string | null {
  const row = feed?.rows.find((row) => row.shape === 'ask' && row.answer === null)
  return row?.id ?? null
}

function WorkButtons({ model }: { model: SessionScreenModel }) {
  const { pick, selectedSessionId, session, work } = model
  return (
    <SessionWorkButtons
      delegations={session?.delegations ?? []}
      delegationTokens={model.delegationTokens}
      onSelectDelegation={(delegationId) =>
        pick({ sessionId: selectedSessionId, delegationId, shellId: null })
      }
      onSelectShell={(shellId) =>
        pick({ sessionId: selectedSessionId, delegationId: null, shellId })
      }
      selectedDelegationId={work.delegationId}
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
      handoff={<SessionHandoffFacts onNavigate={navigate} roster={roster} session={session} />}
      onOpenEvidence={setEvidence}
      onOpenSession={(sessionId) => navigate(`/sessions/${sessionId}`)}
      shell={model.shell}
      shellOutput={model.shellOutput}
    />
  )
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { composer, evidence, feed, feedError, harness, permission, question, session } = model
  const { navigate, selectedSessionId, setEvidence, workReveal } = model
  return (
    <SessionShell
      feed={feed}
      feedError={feedError}
      compactionStartedAt={session?.compactionStartedAt ?? null}
      compactionPercentage={session?.compactionPercentage ?? null}
      compactionTokens={session?.compactionTokens ?? null}
      handoffStartedAt={session?.handoffStartedAt ?? null}
      handoffTo={session?.handoffTo ?? null}
      onOpenSession={(sessionId) => navigate(`/sessions/${sessionId}`)}
      isRunning={session?.status === 'running'}
      optimisticRow={composer.optimisticRow}
      turnMarker={composer.markerView}
      selectedSessionId={selectedSessionId}
      activeEvidenceId={evidence?.id ?? null}
      onOpenEvidence={setEvidence}
      onAnswerQuestion={(_sessionId, questionId, answers) =>
        void question.decide(questionId, answers)
      }
      answeringQuestionId={question.answeringId}
      questionFailure={question.failureFor}
      composer={
        selectedSessionId === null ? null : (
          <SessionComposerArea
            composer={composer}
            permission={permission}
            questionPending={pendingQuestionId(feed) !== null}
            session={session}
            harness={harness}
          />
        )
      }
      headerControls={<WorkButtons model={model} />}
      inspector={<Inspector model={model} />}
      defaultInspectorCollapsed={true}
      // Picking work in the header opens the inspector, the way opening recorded evidence does.
      // Nothing opens it on its own any more: the header buttons are what say a Session has
      // background work (#1582 AC1).
      inspectorReveal={evidence?.id ?? workReveal ?? undefined}
    />
  )
}
