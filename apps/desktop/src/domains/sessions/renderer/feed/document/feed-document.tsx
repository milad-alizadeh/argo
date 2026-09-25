import type { VirtualItem } from '@tanstack/virtual-core'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import {
  foldSettledToolRuns,
  withHeadline,
} from '@/domains/sessions/renderer/feed/model/tool-groups'
import type { SessionEvidence, SessionFeed, SessionFeedRow } from '../../types'
import { sessionPostureLocksAnswer } from '../../types'
import { isFeedRowStreaming } from '../rows/feed-row-renderers'
import type { RevealCache } from '../rows/streaming-text'
import { ToolGroupState } from '../rows/tool-group-state'
import { useReveals } from '../scroll/reveal'
import { NO_MEASUREMENTS } from '../use-feed-measurements-cache'
import { useDrawnRow } from './drawn-row'
import { feedContent } from './feed-content'
import { type FeedLiveFacts, INACTIVE_FEED_LIVE_FACTS } from './feed-live-facts'
import { liveFeedTail } from './feed-tail'
import { promptBesideFeed } from './prompt-beside-feed'
import { useSettledFeed } from './use-settled-feed'

// Shared by FeedDocument and BasicFeed's own prop type, so the two don't drift out of sync.
export type FeedQuestionHandlers = {
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: QuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs?: number
}

export type FeedDocumentContext = {
  active: boolean
  activeEvidenceId: string | null
  initialMeasurementsCache?: VirtualItem[] | undefined
  initialScrollPosition?: number | null
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange?: (sessionId: string, measurements: VirtualItem[]) => void
  onOpenSession: (sessionId: string) => void
  onScrollPositionChange?: (sessionId: string, position: number) => void
  historyLabel: string
} & FeedQuestionHandlers

export type FeedDocumentProps = {
  reading: SessionFeed
  liveFacts: FeedLiveFacts
  actions: FeedDocumentContext
}

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}
function ignoreScrollPositionChange(_sessionId: string, _position: number) {}
function ignoreMeasurementsChange(_sessionId: string, _measurements: VirtualItem[]) {}

function liveRows(reading: SessionFeed, facts: NonNullable<FeedLiveFacts>): SessionFeedRow[] {
  const rows = foldSettledToolRuns(reading.rows.filter((row) => row.shape !== 'thought'))
  const hasTrailingThought = reading.rows.at(-1)?.shape === 'thought'
  const activity =
    facts.compactionStartedAt === null &&
    (facts.isRunning ||
      facts.status === 'unknown' ||
      (facts.activity?.kind === 'thought' && hasTrailingThought))
      ? facts.activity
      : null
  if (activity === null) return rows
  const turnStart = rows.findLastIndex((row) => row.shape === 'prose' && row.role === 'user')
  const last = rows.at(-1)
  if (last?.shape === 'tool-group' && rows.length - 1 > turnStart)
    return [...rows.slice(0, -1), withHeadline(last, activity)]
  if (activity.kind !== 'thought') return rows
  return [...rows, { shape: 'thought', id: `${reading.sessionId}:activity`, text: activity.label }]
}

function withLiveRows(reading: SessionFeed, facts: NonNullable<FeedLiveFacts>): SessionFeed {
  const rows = liveRows(reading, facts)
  // The same reading when nothing moved: the scroller keys its rows on identity.
  const unchanged =
    rows.length === reading.rows.length && rows.every((row, index) => row === reading.rows[index])
  return unchanged ? reading : { ...reading, rows }
}

function liveReading(reading: SessionFeed, liveFacts: FeedLiveFacts) {
  const facts = liveFacts ?? INACTIVE_FEED_LIVE_FACTS
  const settled = withLiveRows(reading, facts)
  const promptRow = promptBesideFeed(settled.rows, facts.optimisticRow, facts.settledPromptRow)
  const readingWithOptimisticRow =
    promptRow === null
      ? settled
      : {
          ...settled,
          revision: `${settled.revision}:${promptRow.id}`,
          rows: [...settled.rows, promptRow],
        }
  return { ...facts, reading: readingWithOptimisticRow }
}

// A kept document remains mounted when another Session is selected, retaining that Session's
// scroller state until the reader returns (#1834).
export function FeedDocument({ reading, liveFacts, actions }: FeedDocumentProps) {
  const { t } = useTranslation('sessions')
  const onJumpToLatestChange = actions.onJumpToLatestChange ?? ignoreJumpToLatestChange
  const live = liveReading(reading, liveFacts)
  const toolGroups = useRef(new ToolGroupState()).current
  const revealCache = useRef<RevealCache>(new Map()).current
  const revealsFor = useReveals()
  const DrawnRow = useDrawnRow({
    sessionId: live.reading.sessionId,
    activeEvidenceId: actions.activeEvidenceId,
    onOpenEvidence: actions.onOpenEvidence,
    toolGroups,
    revealCache,
    onAnswerQuestion: actions.onAnswerQuestion,
    answeringQuestionId: actions.answeringQuestionId,
    questionFailure: actions.questionFailure,
    questionLocked: sessionPostureLocksAnswer(live.posture),
  })
  const { column, settled, stalled, retry } = useSettledFeed({
    active: actions.active,
    sessionId: live.reading.sessionId,
    revision: live.reading.revision,
    rows: live.reading.rows,
    isRunning: live.isRunning,
    stallTimeoutMs: actions.stallTimeoutMs,
  })
  const lastRow = live.reading.rows.at(-1)
  const tailIsLive = lastRow !== undefined && isFeedRowStreaming(lastRow)
  const streamingRowId = live.isRunning && tailIsLive ? lastRow.id : null
  // A quiet marker keeps its box through prose/tool changes, so the Feed height stays stable (#2241).
  const tail = liveFeedTail(live, lastRow, actions.onOpenSession)
  const content = feedContent({
    active: actions.active,
    initialMeasurementsCache: actions.initialMeasurementsCache ?? NO_MEASUREMENTS,
    initialScrollPosition: actions.initialScrollPosition ?? null,
    settled,
    isRunning: live.isRunning,
    stalled,
    posture: live.posture,
    onRetry: retry,
    onJumpToLatestChange,
    onMeasurementsChange: actions.onMeasurementsChange ?? ignoreMeasurementsChange,
    onScrollPositionChange: actions.onScrollPositionChange ?? ignoreScrollPositionChange,
    DrawnRow,
    revealsFor,
    streamingRowId,
    tail,
    emptyText: [t('empty.blank.title'), t('empty.blank.description')],
    historyLabel: actions.historyLabel,
  })
  return (
    <div
      className="feed__document"
      data-active={actions.active}
      data-revision={settled?.reading.revision}
      inert={!actions.active}
    >
      <div className="feed__column" ref={column}>
        {content}
      </div>
    </div>
  )
}
