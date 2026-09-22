import { useCallback, useRef } from 'react'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive'
import type { SessionEvidence, SessionFeedRow } from '../../types'
import { FeedRow } from './feed-row'
import type { Reveal } from './reveal'
import type { RevealCache } from './streaming-text'
import type { ToolGroupState } from './tool-group-state'

export type DrawnRowProps = {
  row: SessionFeedRow
  height?: number
  reveal?: Reveal
  streaming?: boolean
}

const noQuestionFailure = () => null

type DrawnRowInputs = {
  sessionId: string
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  toolGroups: ToolGroupState
  revealCache: RevealCache
  onAnswerQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  // Argo can only write an answer into a Session whose channel it currently holds (#2205); every
  // other posture draws the ask row locked, whatever the transcript says.
  questionLocked: boolean
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
  const revealCache = inputs.revealCache
  const answerQuestion = useRef(inputs.onAnswerQuestion)
  answerQuestion.current = inputs.onAnswerQuestion
  const answeringId = useRef(inputs.answeringQuestionId)
  answeringId.current = inputs.answeringQuestionId
  const failureFor = useRef<(questionId: string) => string | null>(
    typeof inputs.questionFailure === 'function' ? inputs.questionFailure : noQuestionFailure,
  )
  failureFor.current =
    typeof inputs.questionFailure === 'function' ? inputs.questionFailure : noQuestionFailure
  const sessionId = inputs.sessionId
  const questionLocked = inputs.questionLocked
  const onOpenEvidence = useCallback(
    (evidence: SessionEvidence) => openEvidence.current(evidence),
    [],
  )
  const onAnswerQuestion = useCallback(
    (questionId: string, answers: QuestionAnswer[]) =>
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
        revealCache={revealCache}
        onAnswerQuestion={onAnswerQuestion}
        answering={answeringId.current === props.row.id}
        questionFailure={questionFailure(props.row.id)}
        questionLocked={questionLocked}
      />
    ),
    [onAnswerQuestion, onOpenEvidence, questionFailure, questionLocked, toolGroups, revealCache],
  )
}
