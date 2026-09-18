import type { ClaudeQuestionAnswer } from '../../contract/claude-contract'
import { SessionInspector } from '../components/inspector/session-inspector'
import { SessionWorkButtons } from '../components/work/session-work-buttons'
import { SessionWorkInspectorHeader } from '../components/work/session-work-inspector-header'
import { BackgroundWork, type BackgroundWorkLinks } from '../feed/background-work'
import type { SessionFeed } from '../types'
import { SessionComposerArea, SessionHandoffFacts } from './session-screen-details'
import { SessionShell } from './session-shell'
import { type SessionScreenModel, useSessionScreenModel } from './use-session-screen-model'

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
      delegationUsage={model.delegationUsage}
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

// A background work block in the Feed opens the same inspector its header button does.
function backgroundWorkLinks(model: SessionScreenModel): BackgroundWorkLinks {
  const { pick, selectedSessionId, session } = model
  return {
    find: ({ callId, name }) => {
      const command = session?.shell.find((entry) => entry.id === callId)
      if (command !== undefined) return { kind: 'shell', command }
      // A realtime delegation's envelope names no call, only the name the agent was sent with.
      const delegation =
        session?.delegations.find((entry) => entry.id === callId) ??
        session?.delegations.findLast((entry) => name !== null && entry.label === name)
      if (delegation === undefined) return null
      const usage = model.delegationUsage[delegation.id] ?? { tokens: null, model: null }
      return { kind: 'delegation', delegation, usage }
    },
    open: (target) =>
      pick(
        target.kind === 'shell'
          ? { sessionId: selectedSessionId, delegationId: null, shellId: target.command.id }
          : { sessionId: selectedSessionId, delegationId: target.delegation.id, shellId: null },
      ),
  }
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
  if (model.shell !== null) {
    return <SessionWorkInspectorHeader work={{ kind: 'shell', command: model.shell }} />
  }
  if (model.delegation !== null) {
    return (
      <SessionWorkInspectorHeader
        work={{
          kind: 'delegation',
          delegation: model.delegation,
          usage: model.delegationUsage[model.delegation.id] ?? { tokens: null, model: null },
        }}
      />
    )
  }
  return null
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { composer, evidence, feed, feedError, question, session } = model
  const { navigate, retryFeed, selectedSessionId, setEvidence, workReveal } = model
  const openSession = (sessionId: string) => navigate(`/sessions/${sessionId}`)
  const answerQuestion = (
    _sessionId: string,
    questionId: string,
    answers: ClaudeQuestionAnswer[],
  ) => void question.decide(questionId, answers)
  return (
    <BackgroundWork.Provider value={backgroundWorkLinks(model)}>
      <SessionShell
        feed={feed}
        feedError={feedError}
        onRetryFeed={retryFeed}
        liveFacts={{
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
        }}
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
