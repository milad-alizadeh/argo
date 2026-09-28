import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import type { SessionError, SessionFeed, SessionId } from '../../types'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from '../feed-stall'
import { Standing } from '../standing'
import { useFeedMeasurementsCache } from '../use-feed-measurements-cache'
import type { FeedQuestionHandlers } from './feed-document'
import {
  useFeedRetry,
  useFeedScrollPositions,
  useHeldPrompt,
  useKeptDocuments,
} from './feed-document-state'
import type { FeedLiveFacts } from './feed-live-facts'
import { keptDocument } from './kept-document'
import { awaitingAssistantReply } from './use-settled-feed'

import '../feed.css'

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}
function ignoreLoadOlder() {}

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
  liveFacts,
}: {
  current: SessionFeed | null
  failure: SessionError | null
  selectedSessionId: SessionId | null
  liveFacts: FeedLiveFacts
}) {
  return (
    failure === null &&
    selectedSessionId !== null &&
    (current === null || (liveFacts?.isRunning === true && awaitingAssistantReply(current.rows)))
  )
}

function needsStanding({
  current,
  failure,
  stalled,
  holdsPrompt,
}: {
  current: SessionFeed | null
  failure: SessionError | null
  stalled: boolean
  holdsPrompt: boolean
}) {
  return (failure !== null && current === null) || stalled || (current === null && !holdsPrompt)
}

type BasicFeedProps = {
  feed: SessionFeed | null
  hasOlder?: boolean
  loadingOlder?: boolean
  olderError?: boolean
  onLoadOlder?: () => void
  activeEvidenceId: string | null
  liveFacts: FeedLiveFacts
  onOpenSession: (sessionId: string) => void
  failure: SessionError | null
  onRetryFeed: () => void
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  selectedSessionId: SessionId | null
  feedLabel?: string
  historyLabel?: string
} & FeedQuestionHandlers

export function BasicFeed({
  feed,
  hasOlder = false,
  loadingOlder = false,
  olderError = false,
  onLoadOlder = ignoreLoadOlder,
  activeEvidenceId,
  liveFacts: reportedLiveFacts,
  onOpenSession,
  failure,
  onRetryFeed,
  onJumpToLatestChange = ignoreJumpToLatestChange,
  selectedSessionId,
  feedLabel,
  historyLabel,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  stallTimeoutMs = FEED_STALL_TIMEOUT_MS,
}: BasicFeedProps) {
  const { t } = useTranslation('sessions')
  const { initialPosition, savePosition } = useFeedScrollPositions()
  const { initialMeasurementsCache, saveMeasurementsCache } = useFeedMeasurementsCache()
  const { current, ordered } = useKeptDocuments(feed, selectedSessionId)
  const liveFacts = useHeldPrompt(selectedSessionId, reportedLiveFacts)
  // The Standing spinner (below) has no bound of its own: a Session whose read never answers
  // (#2102) never gets a kept document, so `current` stays null forever without this.
  const { retry, retryToken } = useFeedRetry(onRetryFeed)
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
    liveFacts,
  })
  const stalled = useStallTimer(
    awaitingFeed ? `${selectedSessionId}:${retryToken}` : false,
    stallTimeoutMs,
  )
  const shared = {
    selectedSessionId,
    hasOlder,
    loadingOlder,
    olderError,
    onLoadOlder,
    liveFacts,
    activeEvidenceId,
    failure,
    initialMeasurementsCache,
    initialScrollPosition: initialPosition,
    onOpenSession,
    onMeasurementsChange: saveMeasurementsCache,
    onScrollPositionChange: savePosition,
    onJumpToLatestChange,
    onOpenEvidence,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    stallTimeoutMs,
    historyLabel: historyLabel ?? t('historyLabel'),
  }

  return (
    <section
      aria-label={feedLabel ?? t('feedLabel')}
      className="feed"
      data-known-read-failure={failure !== null && current !== null}
    >
      {failure !== null && current !== null ? (
        <Alert className="mx-auto mt-(--spacing-snug) max-w-sm" variant="destructive">
          <AlertTitle>{t('standing.failure')}</AlertTitle>
          <AlertDescription>{failure.message}</AlertDescription>
          <Button onClick={retry} type="button" variant="outline">
            {t('standing.retry')}
          </Button>
        </Alert>
      ) : null}
      {!stalled && documents.map(([id, document]) => keptDocument(id, document, shared))}
      {needsStanding({ current, failure, stalled, holdsPrompt }) ? (
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
