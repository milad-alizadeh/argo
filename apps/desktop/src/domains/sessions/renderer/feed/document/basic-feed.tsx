import type { VirtualItem } from '@tanstack/virtual-core'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { pendingSessionDraft } from '@/domains/sessions/api/pending-session'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Alert, AlertDescription, AlertTitle } from '@/platform/renderer/components/ui/alert'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/platform/renderer/components/ui/empty'
import type {
  SessionError,
  SessionEvidence,
  SessionFeed,
  SessionId,
  SessionPosture,
} from '../../types'
import { FeedLoading } from '../feed-loading'
import { FEED_STALL_TIMEOUT_MS, useStallTimer } from '../feed-stall'
import { isFeedRowStreaming } from '../rows/feed-row-renderers'
import type { RevealCache } from '../rows/streaming-text'
import { ToolGroupState } from '../rows/tool-group-state'
import { AnchoredFeed } from '../scroll/anchored-feed'
import { useReveals } from '../scroll/reveal'
import { Standing } from '../standing'
import { useFeedMeasurementsCache } from '../use-feed-measurements-cache'
import { useDrawnRow } from './drawn-row'
import { useFeedRetry, useFeedScrollPositions } from './feed-document-state'
import { awaitingAssistantReply, useSettledFeed } from './use-settled-feed'

import '../feed.css'

// Shared by the Feed view and its callers, so the two do not drift out of sync.
type FeedQuestionHandlers = {
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}
function ignoreMeasurementsChange(_sessionId: string, _measurements: VirtualItem[]) {}

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

type BasicFeedProps = {
  feed: SessionFeed | null
  activeEvidenceId: string | null
  // The Session's own liveness and posture, the facts the Roster reads too.
  running: boolean
  posture: SessionPosture | null
  failure: SessionError | null
  onRetryFeed: () => void
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  selectedSessionId: SessionId | null
  onStalledChange?: (sessionId: SessionId | null) => void
  feedLabel?: string
  historyLabel?: string
  stallTimeoutMs?: number
} & FeedQuestionHandlers

// The Feed a reader sees: main's rows drawn in order, with this browser's measurement, scroll,
// disclosure and reveal state. It makes no Feed row of its own.
export function BasicFeed({
  feed,
  activeEvidenceId,
  running,
  posture,
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
  const document = feed !== null && feed.sessionId === selectedSessionId ? feed : null
  // The selected Feed has no history row to settle its first read (#2102).
  const { retry, retryToken } = useFeedRetry(onRetryFeed)
  // Only the first read of a named Session stalls; a reply wait keeps the running loader (#3170).
  const awaitingFeed =
    failure === null &&
    selectedSessionId !== null &&
    pendingSessionDraft(selectedSessionId) === null &&
    document === null
  const stalled = useStallTimer(
    awaitingFeed ? `${selectedSessionId}:${retryToken}` : false,
    stallTimeoutMs,
  )
  useEffect(() => {
    onStalledChange?.(stalled ? selectedSessionId : null)
  }, [onStalledChange, selectedSessionId, stalled])

  return (
    <section
      aria-label={feedLabel ?? t('feedLabel')}
      className="feed"
      data-known-read-failure={failure !== null && document !== null}
    >
      {feedFailureNotice({
        failure,
        hasCurrent: document !== null,
        title: t('standing.failure'),
        retryLabel: t('standing.retry'),
        onRetry: retry,
      })}
      {document === null ? null : (
        <FeedDocument
          key={document.sessionId}
          reading={document}
          running={running}
          questionLocked={posture !== 'live'}
          activeEvidenceId={activeEvidenceId}
          initialMeasurementsCache={initialMeasurementsCache(document.sessionId)}
          initialScrollPosition={initialPosition(document.sessionId)}
          onMeasurementsChange={saveMeasurementsCache}
          onScrollPositionChange={savePosition}
          onJumpToLatestChange={onJumpToLatestChange}
          onOpenEvidence={onOpenEvidence}
          onAnswerQuestion={onAnswerQuestion}
          answeringQuestionId={answeringQuestionId}
          questionFailure={questionFailure}
          historyLabel={historyLabel ?? t('historyLabel')}
        />
      )}
      {document === null ? (
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

type FeedDocumentProps = {
  reading: SessionFeed
  running: boolean
  questionLocked: boolean
  activeEvidenceId: string | null
  initialMeasurementsCache: VirtualItem[]
  initialScrollPosition: number | null
  onMeasurementsChange?: (sessionId: string, measurements: VirtualItem[]) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  onJumpToLatestChange: (sessionId: string, action: (() => void) | null) => void
  historyLabel: string
} & FeedQuestionHandlers

function EmptyFeed({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="empty-feed" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// The selected document owns its virtualized history and scroll state.
function FeedDocument({
  reading,
  running,
  questionLocked,
  activeEvidenceId,
  initialMeasurementsCache,
  initialScrollPosition,
  onMeasurementsChange = ignoreMeasurementsChange,
  onScrollPositionChange,
  onJumpToLatestChange,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  historyLabel,
}: FeedDocumentProps) {
  const { t } = useTranslation('sessions')
  const toolGroups = useRef(new ToolGroupState()).current
  const revealCache = useRef<RevealCache>(new Map()).current
  const DrawnRow = useDrawnRow({
    sessionId: reading.sessionId,
    activeEvidenceId,
    onOpenEvidence,
    toolGroups,
    revealCache,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    questionLocked,
  })
  const { column, settled } = useSettledFeed({
    sessionId: reading.sessionId,
    revision: reading.revision,
    rows: reading.rows,
  })
  const reveals = useReveals(settled)
  const lastRow = reading.rows.at(-1)
  const tailIsLive = lastRow !== undefined && isFeedRowStreaming(lastRow)
  const streamingRowId = running && tailIsLive ? lastRow.id : null
  const noRows = settled === null || settled.rows.length === 0
  const awaitingReply = running && (noRows || awaitingAssistantReply(settled?.rows ?? []))
  return (
    <div className="feed__document" data-active="true" data-revision={settled?.reading.revision}>
      <div className="feed__column" ref={column}>
        {noRows ? null : (
          <AnchoredFeed
            active
            initialMeasurementsCache={initialMeasurementsCache}
            initialScrollPosition={initialScrollPosition}
            rows={settled.rows}
            settled={settled}
            FeedRow={DrawnRow}
            onJumpToLatestChange={onJumpToLatestChange}
            onMeasurementsChange={onMeasurementsChange}
            onScrollPositionChange={onScrollPositionChange}
            reveals={reveals}
            streamingRowId={streamingRowId}
            historyLabel={historyLabel}
          />
        )}
        {noRows && !awaitingReply ? (
          <EmptyFeed title={t('empty.blank.title')} description={t('empty.blank.description')} />
        ) : null}
        {awaitingReply ? <FeedLoading state="running" /> : null}
      </div>
    </div>
  )
}
