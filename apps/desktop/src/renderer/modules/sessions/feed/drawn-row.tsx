import { useCallback, useRef, useState } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeedRow } from '../types'
import { FeedRow } from './FeedRow'
import type { Reveal } from './reveal'

export type DrawnRowProps = {
  row: SessionFeedRow
  height?: number
  reveal?: Reveal
  streaming?: boolean
}

export function useToolGroups() {
  const [openToolGroups, setOpenToolGroups] = useState<Set<string>>(new Set())
  const onOpenToolGroup = (id: string, open: boolean) => {
    setOpenToolGroups((previous) => {
      const next = new Set(previous)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }
  return { onOpenToolGroup, openToolGroups }
}

type DrawnRowInputs = {
  sessionId: string
  activeEvidenceId: string | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  openToolGroups: ReadonlySet<string>
  onOpenToolGroup: (id: string, open: boolean) => void
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
  const toolGroups = useRef(inputs.openToolGroups)
  toolGroups.current = inputs.openToolGroups
  const openToolGroup = useRef(inputs.onOpenToolGroup)
  openToolGroup.current = inputs.onOpenToolGroup
  const answerQuestion = useRef(inputs.onAnswerQuestion)
  answerQuestion.current = inputs.onAnswerQuestion
  const answeringId = useRef(inputs.answeringQuestionId)
  answeringId.current = inputs.answeringQuestionId
  const failureFor = useRef(inputs.questionFailure)
  failureFor.current = inputs.questionFailure
  const sessionId = inputs.sessionId

  return useCallback(
    (props: DrawnRowProps) => (
      <FeedRow
        {...props}
        activeEvidenceId={evidence.current}
        onOpenEvidence={(evidence) => openEvidence.current(evidence)}
        onOpenToolGroup={openToolGroup.current}
        openToolGroups={toolGroups.current}
        onAnswerQuestion={(questionId, answers) =>
          answerQuestion.current(sessionId, questionId, answers)
        }
        answeringQuestionId={answeringId.current}
        questionFailure={(questionId) => failureFor.current(questionId)}
      />
    ),
    [sessionId],
  )
}
