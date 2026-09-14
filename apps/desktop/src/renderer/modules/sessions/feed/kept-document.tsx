import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type {
  SessionError,
  SessionEvidence,
  SessionFeed,
  SessionFeedRow,
  SessionId,
} from '../types'
import { FeedDocument } from './FeedDocument'
import type { TurnMarkerView } from './turn-marker'

// The optimistic Turn row rides above the transcript's own rows, under its own revision so the
// Feed's layout pass re-measures the one row it adds rather than reusing a cached reading.
function withOptimisticRow(feed: SessionFeed, row: SessionFeedRow | null): SessionFeed {
  if (row === null) return feed
  return { ...feed, revision: `${feed.revision}:${row.id}`, rows: [...feed.rows, row] }
}

type LiveFacts = {
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  handoffStartedAt: string | null
  handoffTo: string | null
  isRunning: boolean
  optimisticRow: SessionFeedRow | null
  turnMarker: TurnMarkerView | null
  posture: 'managed' | 'external' | null
}

// Only the selected document shows live facts (compaction, handoff, the optimistic row, the
// Turn Marker, posture); a kept-but-inactive document renders its own settled transcript alone.
function selectedDocumentProps(
  id: SessionId,
  selectedSessionId: SessionId | null,
  facts: LiveFacts,
) {
  if (id !== selectedSessionId)
    return {
      compactionStartedAt: null,
      compactionPercentage: null,
      compactionTokens: null,
      handoffStartedAt: null,
      handoffTo: null,
      isRunning: false,
      optimisticRow: null,
      turnMarker: null,
      posture: null,
    }
  return facts
}

export type KeptDocumentShared = {
  selectedSessionId: SessionId | null
  facts: LiveFacts
  activeEvidenceId: string | null
  failure: SessionError | null
  onOpenSession: (sessionId: string) => void
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs: number
}

export function keptDocument(id: SessionId, document: SessionFeed, shared: KeptDocumentShared) {
  const selected = selectedDocumentProps(id, shared.selectedSessionId, shared.facts)
  return (
    <FeedDocument
      active={shared.failure === null && id === shared.selectedSessionId}
      activeEvidenceId={shared.activeEvidenceId}
      compactionStartedAt={selected.compactionStartedAt}
      compactionPercentage={selected.compactionPercentage}
      compactionTokens={selected.compactionTokens}
      handoffStartedAt={selected.handoffStartedAt}
      handoffTo={selected.handoffTo}
      onOpenSession={shared.onOpenSession}
      feed={withOptimisticRow(document, selected.optimisticRow)}
      key={id}
      onOpenEvidence={shared.onOpenEvidence}
      isRunning={selected.isRunning}
      posture={selected.posture}
      turnMarker={selected.turnMarker}
      onAnswerQuestion={shared.onAnswerQuestion}
      answeringQuestionId={shared.answeringQuestionId}
      questionFailure={shared.questionFailure}
      stallTimeoutMs={shared.stallTimeoutMs}
    />
  )
}
