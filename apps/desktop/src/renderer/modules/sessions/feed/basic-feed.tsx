import { useCallback, useState } from 'react'
import { isOptimisticSessionId } from '../state/use-session-creation-store'
import type { SessionError, SessionFeed, SessionId } from '../types'
import type { FeedQuestionHandlers } from './feed-document'
import type { FeedLiveFacts } from './feed-live-facts'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { keptDocument } from './kept-document'
import { Standing } from './standing'
import { useKeptDocuments } from './use-kept-documents'

import './feed.css'

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}

export function BasicFeed({
  feed,
  activeEvidenceId,
  liveFacts,
  onOpenSession,
  failure,
  onRetryFeed,
  onJumpToLatestChange = ignoreJumpToLatestChange,
  selectedSessionId,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  stallTimeoutMs = FEED_STALL_TIMEOUT_MS,
}: {
  feed: SessionFeed | null
  activeEvidenceId: string | null
  liveFacts: FeedLiveFacts
  onOpenSession: (sessionId: string) => void
  failure: SessionError | null
  onRetryFeed: () => void
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  selectedSessionId: SessionId | null
} & FeedQuestionHandlers) {
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)
  // The Standing spinner (below) has no bound of its own: a Session whose read never answers
  // (#2102) never gets a kept document, so `current` stays null forever without this.
  const [retryToken, setRetryToken] = useState(0)
  const optimisticSession = selectedSessionId !== null && isOptimisticSessionId(selectedSessionId)
  const awaitingFeed =
    failure === null && selectedSessionId !== null && !optimisticSession && current === null
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
    liveFacts,
    activeEvidenceId,
    failure,
    onOpenSession,
    onJumpToLatestChange,
    onOpenEvidence,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    stallTimeoutMs,
  }

  return (
    <section aria-label="Session Feed" className="feed">
      {ordered.map(([id, document]) => keptDocument(id, document, shared))}
      {failure !== null || (current === null && !optimisticSession) ? (
        <Standing
          failure={failure}
          selected={selectedSessionId !== null}
          stalled={stalled}
          posture={liveFacts?.posture ?? null}
          onRetry={retry}
        />
      ) : null}
    </section>
  )
}
