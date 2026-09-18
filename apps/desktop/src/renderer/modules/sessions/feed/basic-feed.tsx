import { useCallback, useState } from 'react'
import { isOptimisticSessionId } from '../state/use-session-creation-store'
import type { SessionError, SessionFeed, SessionId } from '../types'
import type { FeedQuestionHandlers } from './feed-document'
import type { FeedLiveFacts } from './feed-live-facts'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { keptDocument } from './kept-document'
import { Standing } from './standing'
import { useHeldPrompt } from './use-held-prompt'
import { useKeptDocuments } from './use-kept-documents'
import { awaitingAssistantReply } from './use-settled-feed'

import './feed.css'

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}

// A pending id has no Feed to read, so this empty document lets the prompt row and Turn Marker mount at once (#2430).
function optimisticFeedDocument(sessionId: SessionId): SessionFeed {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: sessionId,
    sessionId,
    chainId: sessionId,
    revision: 'optimistic',
    rows: [],
  }
}

export function BasicFeed({
  feed,
  activeEvidenceId,
  liveFacts: reportedLiveFacts,
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
  const liveFacts = useHeldPrompt(selectedSessionId, reportedLiveFacts)
  // The Standing spinner (below) has no bound of its own: a Session whose read never answers
  // (#2102) never gets a kept document, so `current` stays null forever without this.
  const [retryToken, setRetryToken] = useState(0)
  const optimisticSession = selectedSessionId !== null && isOptimisticSessionId(selectedSessionId)
  // The prompt row outlives the temporary id: the real Session's first read can trail the hand-off.
  const holdsPrompt =
    current === null &&
    selectedSessionId !== null &&
    (liveFacts?.optimisticRow != null || liveFacts?.settledPromptRow != null)
  const optimisticDocument = holdsPrompt ? optimisticFeedDocument(selectedSessionId) : null
  const documents =
    optimisticDocument === null
      ? ordered
      : [[optimisticDocument.sessionId, optimisticDocument] as const]
  const awaitingFeed =
    failure === null &&
    selectedSessionId !== null &&
    !optimisticSession &&
    (current === null || (liveFacts?.isRunning === true && awaitingAssistantReply(current.rows)))
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
      {!stalled && documents.map(([id, document]) => keptDocument(id, document, shared))}
      {failure !== null || stalled || (current === null && !optimisticSession && !holdsPrompt) ? (
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
