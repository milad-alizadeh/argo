import { useCallback, useState } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type {
  SessionError,
  SessionEvidence,
  SessionFeed,
  SessionFeedRow,
  SessionId,
} from '../types'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { keptDocument } from './kept-document'
import { Standing } from './Standing'
import type { TurnMarkerView } from './turn-marker'
import { useKeptDocuments } from './useKeptDocuments'

import './feed.css'

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
  onRetryFeed,
  isRunning,
  optimisticRow = null,
  posture = null,
  selectedSessionId,
  turnMarker = null,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  stallTimeoutMs = FEED_STALL_TIMEOUT_MS,
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
  onRetryFeed: () => void
  isRunning: boolean
  optimisticRow?: SessionFeedRow | null
  posture?: 'managed' | 'external' | null
  selectedSessionId: SessionId | null
  turnMarker?: TurnMarkerView | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs?: number
}) {
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)
  // The Standing spinner (below) has no bound of its own: a Session whose read never answers
  // (#2102) never gets a kept document, so `current` stays null forever without this.
  const [retryToken, setRetryToken] = useState(0)
  const awaitingFeed = failure === null && selectedSessionId !== null && current === null
  const stalled = useStallTimer(
    awaitingFeed ? `${selectedSessionId}:${retryToken}` : false,
    stallTimeoutMs,
  )
  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
    onRetryFeed()
  }, [onRetryFeed])

  const shared = {
    selectedSessionId,
    facts: {
      compactionStartedAt,
      compactionPercentage,
      compactionTokens,
      handoffStartedAt,
      handoffTo,
      isRunning,
      optimisticRow,
      turnMarker,
      posture,
    },
    activeEvidenceId,
    failure,
    onOpenSession,
    onOpenEvidence,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    stallTimeoutMs,
  }

  return (
    <section aria-label="Session Feed" className="feed">
      {ordered.map(([id, document]) => keptDocument(id, document, shared))}
      {failure !== null || current === null ? (
        <Standing
          failure={failure}
          selected={selectedSessionId !== null}
          stalled={stalled}
          posture={posture}
          onRetry={retry}
        />
      ) : null}
    </section>
  )
}
