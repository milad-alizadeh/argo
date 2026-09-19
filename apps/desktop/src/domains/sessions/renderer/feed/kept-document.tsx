import type { QuestionAnswer } from '../../contract/question'
import type { SessionError, SessionEvidence, SessionFeed, SessionId } from '../types'
import type { FeedDocumentContext } from './feed-document'
import { FeedDocument } from './feed-document'
import type { FeedLiveFacts } from './feed-live-facts'

// Only the selected document shows live facts (compaction, handoff, the optimistic row, the
// Turn Marker, posture); a kept-but-inactive document renders its own settled transcript alone.
function selectedLiveFacts(
  id: SessionId,
  selectedSessionId: SessionId | null,
  liveFacts: FeedLiveFacts,
) {
  return id === selectedSessionId ? liveFacts : null
}

export type KeptDocumentShared = {
  selectedSessionId: SessionId | null
  liveFacts: FeedLiveFacts
  activeEvidenceId: string | null
  failure: SessionError | null
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  onOpenSession: (sessionId: string) => void
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs: number
}

export function keptDocument(id: SessionId, document: SessionFeed, shared: KeptDocumentShared) {
  const liveFacts = selectedLiveFacts(id, shared.selectedSessionId, shared.liveFacts)
  const actions: FeedDocumentContext = {
    active: shared.failure === null && id === shared.selectedSessionId,
    activeEvidenceId: shared.activeEvidenceId,
    onJumpToLatestChange: shared.onJumpToLatestChange,
    onOpenSession: shared.onOpenSession,
    onOpenEvidence: shared.onOpenEvidence,
    onAnswerQuestion: shared.onAnswerQuestion,
    answeringQuestionId: shared.answeringQuestionId,
    questionFailure: shared.questionFailure,
    stallTimeoutMs: shared.stallTimeoutMs,
  }
  return <FeedDocument actions={actions} key={id} liveFacts={liveFacts} reading={document} />
}
