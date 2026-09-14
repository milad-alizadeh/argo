import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type {
  SessionError,
  SessionEvidence,
  SessionFeed,
  SessionFeedRow,
  SessionId,
} from '../types'
import { FeedDocument } from './FeedDocument'
import { Standing } from './Standing'
import type { TurnMarkerView } from './turn-marker'
import { useKeptDocuments } from './useKeptDocuments'

import './feed.css'

// The optimistic Turn row rides above the transcript's own rows, under its own revision so the
// Feed's layout pass re-measures the one row it adds rather than reusing a cached reading.
function withOptimisticRow(feed: SessionFeed, row: SessionFeedRow | null): SessionFeed {
  if (row === null) return feed
  return { ...feed, revision: `${feed.revision}:${row.id}`, rows: [...feed.rows, row] }
}

// Only the selected document shows live facts (compaction, handoff, the optimistic row, the
// Turn Marker); a kept-but-inactive document renders its own settled transcript alone.
function selectedDocumentProps(
  id: SessionId,
  selectedSessionId: SessionId | null,
  facts: {
    compactionStartedAt: string | null
    compactionPercentage: number | null
    compactionTokens: string | null
    handoffStartedAt: string | null
    handoffTo: string | null
    isRunning: boolean
    optimisticRow: SessionFeedRow | null
    turnMarker: TurnMarkerView | null
  },
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
    }
  return facts
}

export function BasicFeed({
  feed,
  activeEvidenceId,
  compactionStartedAt = null,
  compactionPercentage = null,
  compactionTokens = null,
  handoffStartedAt = null,
  handoffTo = null,
  onOpenSession,
  failure,
  isRunning,
  optimisticRow = null,
  selectedSessionId,
  turnMarker = null,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
}: {
  feed: SessionFeed | null
  activeEvidenceId: string | null
  compactionStartedAt?: string | null
  compactionPercentage?: number | null
  compactionTokens?: string | null
  handoffStartedAt?: string | null
  handoffTo?: string | null
  onOpenSession: (sessionId: string) => void
  failure: SessionError | null
  isRunning: boolean
  optimisticRow?: SessionFeedRow | null
  selectedSessionId: SessionId | null
  turnMarker?: TurnMarkerView | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}) {
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)
  const facts = {
    compactionStartedAt,
    compactionPercentage,
    compactionTokens,
    handoffStartedAt,
    handoffTo,
    isRunning,
    optimisticRow,
    turnMarker,
  }

  return (
    <section aria-label="Session Feed" className="feed">
      {ordered.map(([id, document]) => {
        const selected = selectedDocumentProps(id, selectedSessionId, facts)
        return (
          <FeedDocument
            active={failure === null && id === selectedSessionId}
            activeEvidenceId={activeEvidenceId}
            compactionStartedAt={selected.compactionStartedAt}
            compactionPercentage={selected.compactionPercentage}
            compactionTokens={selected.compactionTokens}
            handoffStartedAt={selected.handoffStartedAt}
            handoffTo={selected.handoffTo}
            onOpenSession={onOpenSession}
            feed={withOptimisticRow(document, selected.optimisticRow)}
            key={id}
            onOpenEvidence={onOpenEvidence}
            isRunning={selected.isRunning}
            turnMarker={selected.turnMarker}
            onAnswerQuestion={onAnswerQuestion}
            answeringQuestionId={answeringQuestionId}
            questionFailure={questionFailure}
          />
        )
      })}
      {failure !== null || current === null ? (
        <Standing failure={failure} selected={selectedSessionId !== null} />
      ) : null}
    </section>
  )
}
