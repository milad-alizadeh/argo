import { useCallback, useRef } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedRow } from './FeedRow'
import type { Reveal } from './reveal'
import type { ToolGroupState } from './tool-group-state'

export type DrawnRowProps = { row: SessionFeedRow; height?: number; reveal?: Reveal }

type DrawnRowInputs = {
  sessionId: string
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  toolGroups: ToolGroupState
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}

// One component for the life of the deck: a new one each render would remount every row and
// replay its reveal. Each drawing prop is read off a ref rather than closed over, so this
// component never has to change identity when only, say, `answeringQuestionId` changes.
export function useDrawnRow(inputs: DrawnRowInputs) {
  const evidence = useRef(inputs.activeEvidenceId)
  evidence.current = inputs.activeEvidenceId
  const openEvidence = useRef(inputs.onOpenEvidence)
  openEvidence.current = inputs.onOpenEvidence
  const toolGroups = inputs.toolGroups
  const answerQuestion = useRef(inputs.onAnswerQuestion)
  answerQuestion.current = inputs.onAnswerQuestion
  const answeringId = useRef(inputs.answeringQuestionId)
  answeringId.current = inputs.answeringQuestionId
  const failureFor = useRef(inputs.questionFailure)
  failureFor.current = inputs.questionFailure
  const sessionId = inputs.sessionId
  const onOpenEvidence = useCallback(
    (evidence: SessionEvidence) => openEvidence.current(evidence),
    [],
  )
  const onAnswerQuestion = useCallback(
    (questionId: string, answers: ClaudeQuestionAnswer[]) =>
      answerQuestion.current(sessionId, questionId, answers),
    [sessionId],
  )
  const questionFailure = useCallback((questionId: string) => failureFor.current(questionId), [])

  return useCallback(
    (props: DrawnRowProps) => (
      <FeedRow
        {...props}
        activeEvidenceId={evidence.current}
        onOpenEvidence={onOpenEvidence}
        toolGroups={toolGroups}
        onAnswerQuestion={onAnswerQuestion}
        answeringQuestionId={answeringId.current}
        questionFailure={questionFailure}
      />
    ),
    [onAnswerQuestion, onOpenEvidence, questionFailure, toolGroups],
  )
}
