import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import type { SessionError, SessionFeed, SessionId } from '../../types'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from '../feed-stall'
import { StalledFeed } from '../stalled-feed'
import { Standing } from '../standing'
import { useFeedMeasurementsCache } from '../use-feed-measurements-cache'
import type { FeedDocumentContext, FeedQuestionHandlers } from './feed-document'
import { FeedDocument } from './feed-document'
import { useFeedRetry, useFeedScrollPositions, useHeldPrompt } from './feed-document-state'
import type { FeedLiveFacts } from './feed-live-facts'
import { promptBesideFeed } from './prompt-beside-feed'
import { awaitingAssistantReply } from './use-settled-feed'

import '../feed.css'

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
  liveFacts,
}: {
  current: SessionFeed | null
  failure: SessionError | null
  selectedSessionId: SessionId | null
  liveFacts: FeedLiveFacts
}) {
  if (selectedSessionId?.startsWith('optimistic:') === true) return false
  const displayedPrompt = promptBesideFeed(
    current?.rows ?? [],
    liveFacts?.optimisticRow ?? null,
    liveFacts?.settledPromptRow ?? null,
  )
  const waitingOnDisplayedPrompt =
    displayedPrompt?.shape === 'prose' && displayedPrompt.role === 'user'
  return (
    failure === null &&
    selectedSessionId !== null &&
    (current === null ||
      (liveFacts?.isRunning === true &&
        (awaitingAssistantReply(current.rows) || waitingOnDisplayedPrompt)))
  )
}

function needsStanding({
  current,
  failure,
  holdsPrompt,
}: {
  current: SessionFeed | null
  failure: SessionError | null
  holdsPrompt: boolean
}) {
  return (failure !== null && current === null) || (current === null && !holdsPrompt)
}

function feedFailureNotice({
  failure,
  hasCurrent,
  title,
  retryLabel,
  onRetry,
}: {
  failure: SessionError | null
  hasCurrent: boolean
  title: string
  retryLabel: string
  onRetry: () => void
}) {
  if (failure === null || !hasCurrent) return null
  return (
    <Alert className="mx-auto mt-(--spacing-snug) max-w-sm" variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{failure.message}</AlertDescription>
      <Button onClick={onRetry} type="button" variant="outline">
        {retryLabel}
      </Button>
    </Alert>
  )
}

function stalledFeedNotice({
  stalled,
  hasDocument,
  posture,
  onRetry,
}: {
  stalled: boolean
  hasDocument: boolean
  posture: 'live' | 'external' | null
  onRetry: () => void
}) {
  if (!stalled || !hasDocument) return null
  return <StalledFeed compact posture={posture} onRetry={onRetry} />
}

function heldPromptSessionId({
  current,
  selectedSessionId,
  liveFacts,
}: {
  current: SessionFeed | null
  selectedSessionId: SessionId | null
  liveFacts: FeedLiveFacts
}): SessionId | null {
  if (
    current === null &&
    selectedSessionId !== null &&
    (liveFacts?.optimisticRow != null || liveFacts?.settledPromptRow != null)
  )
    return selectedSessionId
  return null
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
  onStalledChange?: (sessionId: SessionId | null) => void
  feedLabel?: string
  historyLabel?: string
  stallTimeoutMs?: number
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
  onStalledChange,
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
  const current = feed !== null && feed.sessionId === selectedSessionId ? feed : null
  const liveFacts = useHeldPrompt(selectedSessionId, reportedLiveFacts)
  // The selected Feed has no history row to settle its first read (#2102).
  const { retry, retryToken } = useFeedRetry(onRetryFeed)
  // The prompt row outlives the temporary id: the real Session's first read can trail the hand-off.
  const heldPromptId = heldPromptSessionId({ current, selectedSessionId, liveFacts })
  const hasHeldPrompt = heldPromptId !== null
  const optimisticDocument = heldPromptId === null ? null : optimisticFeedDocument(heldPromptId)
  const document = optimisticDocument ?? current
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
  useEffect(() => {
    onStalledChange?.(stalled ? selectedSessionId : null)
  }, [onStalledChange, selectedSessionId, stalled])
  const actions: FeedDocumentContext = {
    stalled,
    activeEvidenceId,
    initialMeasurementsCache:
      selectedSessionId === null ? [] : initialMeasurementsCache(selectedSessionId),
    initialScrollPosition: selectedSessionId === null ? null : initialPosition(selectedSessionId),
    onOpenSession,
    onMeasurementsChange: saveMeasurementsCache,
    onScrollPositionChange: savePosition,
    onJumpToLatestChange,
    onOpenEvidence,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    historyLabel: historyLabel ?? t('historyLabel'),
  }

  return (
    <section
      aria-label={feedLabel ?? t('feedLabel')}
      className="feed"
      data-known-read-failure={failure !== null && current !== null}
    >
      {feedFailureNotice({
        failure,
        hasCurrent: current !== null,
        title: t('standing.failure'),
        retryLabel: t('standing.retry'),
        onRetry: retry,
      })}
      {document === null ? null : (
        <FeedDocument
          actions={actions}
          key={document.sessionId}
          liveFacts={liveFacts}
          reading={document}
        />
      )}
      {stalledFeedNotice({
        stalled,
        hasDocument: document !== null,
        posture: liveFacts?.posture ?? null,
        onRetry: retry,
      })}
      {needsStanding({ current, failure, holdsPrompt: hasHeldPrompt }) ? (
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
