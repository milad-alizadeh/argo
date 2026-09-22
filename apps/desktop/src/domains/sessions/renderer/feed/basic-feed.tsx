import { useTranslation } from 'react-i18next'
import { isOptimisticSessionId } from '@/domains/sessions/renderer/session-creation'
import type { SessionError, SessionFeed, SessionId } from '@/domains/sessions/renderer/types'
import type { FeedQuestionHandlers } from './feed-document'
import type { FeedLiveFacts } from './feed-live-facts'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from './feed-stall'
import { keptDocument } from './kept-document'
import { Standing } from './standing'
import { useFeedRetry } from './use-feed-retry'
import { useFeedScrollPositions } from './use-feed-scroll-positions'
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

function awaitingSelectedFeed({
  current,
  failure,
  selectedSessionId,
  optimisticSession,
  liveFacts,
}: {
  current: SessionFeed | null
  failure: SessionError | null
  selectedSessionId: SessionId | null
  optimisticSession: boolean
  liveFacts: FeedLiveFacts
}) {
  return (
    failure === null &&
    selectedSessionId !== null &&
    !optimisticSession &&
    (current === null || (liveFacts?.isRunning === true && awaitingAssistantReply(current.rows)))
  )
}

type BasicFeedProps = {
  feed: SessionFeed | null
  activeEvidenceId: string | null
  liveFacts: FeedLiveFacts
  onOpenSession: (sessionId: string) => void
  failure: SessionError | null
  onRetryFeed: () => void
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  selectedSessionId: SessionId | null
} & FeedQuestionHandlers

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
}: BasicFeedProps) {
  const { t } = useTranslation('sessions')
  const { initialPosition, savePosition } = useFeedScrollPositions()
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)
  const liveFacts = useHeldPrompt(selectedSessionId, reportedLiveFacts)
  // The Standing spinner (below) has no bound of its own: a Session whose read never answers
  // (#2102) never gets a kept document, so `current` stays null forever without this.
  const { retry, retryToken } = useFeedRetry(onRetryFeed)
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
  const awaitingFeed = awaitingSelectedFeed({
    current,
    failure,
    selectedSessionId,
    optimisticSession,
    liveFacts,
  })
  const stalled = useStallTimer(
    awaitingFeed ? `${selectedSessionId}:${retryToken}` : false,
    stallTimeoutMs,
  )
  const shared = {
    selectedSessionId,
    liveFacts,
    activeEvidenceId,
    failure,
    initialScrollPosition: initialPosition,
    onOpenSession,
    onScrollPositionChange: savePosition,
    onJumpToLatestChange,
    onOpenEvidence,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    stallTimeoutMs,
  }

  return (
    <section aria-label={t('feedLabel')} className="feed">
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
