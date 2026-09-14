import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { useProjects } from '../../projects/hooks/useProjects'
import type { WorkSelection } from '../components/SessionInspector'
import { SessionInspector } from '../components/SessionInspector'
import { SessionComposerArea } from '../components/SessionScreenDetails'
import { COMPOSER_FOCUS_STATE } from '../composer-focus-state'
import { useSessionComposer } from '../hooks/useSessionComposer'
import { useSessionPermission } from '../hooks/useSessionPermission'
import { useSessionQuestion } from '../hooks/useSessionQuestion'
import { useSessions } from '../hooks/useSessions'
import { useDelegationUsage, useShellOutput } from '../hooks/useSessionWork'
import { useComposerStore } from '../state/useComposerStore'
import type { SessionFeed, SessionFeedRow } from '../types'
import { SessionShell } from './SessionShell'
import { sessionHarness, sessionHasBackgroundWork, sessionHasWork } from './sessionScreenState'
import { useSelectedSession } from './useSelectedSession'

// An unanswered `AskUserQuestion` tool call, if the Feed is currently showing one.
function pendingQuestionId(feed: SessionFeed | null): string | null {
  const row = feed?.rows.find((row) => row.shape === 'ask' && row.answer === null)
  return row?.id ?? null
}

const NOTHING_PICKED: WorkSelection = { sessionId: null, delegationId: null, shellId: null }

function pickedIn(selection: WorkSelection, sessionId: string | null): WorkSelection {
  return selection.sessionId === sessionId ? selection : { ...NOTHING_PICKED, sessionId }
}

// A screen is a thin container: it resolves state here, and SessionScreenView hands a pure
// render surface the result.
function useSessionScreenModel() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [cockpit] = useProjects()
  const selectedSessionId = sessionId === 'new' ? null : (sessionId ?? null)
  const [picked, setPicked] = useState<WorkSelection>(NOTHING_PICKED)
  const work = pickedIn(picked, selectedSessionId)
  const { feed, feedError, roster } = useSessions(selectedSessionId, work.delegationId)
  const lastHarness = useComposerStore(({ harness }) => harness)
  const chooseHarness = useComposerStore(({ chooseHarness }) => chooseHarness)
  const session = useSelectedSession(selectedSessionId, roster)
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
  const shell = session?.shell.find((command) => command.id === work.shellId) ?? null
  const delegationTokens = useDelegationUsage(
    session === null || session.delegations.length === 0 ? null : selectedSessionId,
    session?.delegations.some((delegation) => !delegation.landed) === true,
  )
  const shellOutput = useShellOutput(
    selectedSessionId,
    shell?.id ?? null,
    shell?.state === 'running',
  )
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
    work,
    setPicked,
    shell,
    shellOutput,
    delegationTokens,
  }
}

export function SessionScreenView() {
  const model = useSessionScreenModel()
  const { composer, evidence, feed, feedError, harness, permission, question, session } = model
  const { selectedSessionId, setEvidence } = model
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
        <SessionInspector
          delegationTokens={model.delegationTokens}
          evidence={evidence}
          onPick={model.setPicked}
          selectedSessionId={selectedSessionId}
          session={session}
          shell={model.shell}
          shellOutput={model.shellOutput}
          work={model.work}
        />
      }
      defaultInspectorCollapsed={!hasSessionWork}
      // Background work opens a collapsed inspector the way opening recorded evidence does: a
      // Shell running in the background is the one thing about a Session nothing else shows
      // (#1582 AC1).
      inspectorReveal={
        evidence?.id ??
        (sessionHasBackgroundWork(session) ? `work:${selectedSessionId}` : undefined)
      }
    />
  )
}
