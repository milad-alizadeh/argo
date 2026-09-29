import type { VirtualItem } from '@tanstack/virtual-core'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { withHeadline } from '@/domains/sessions/api/feed/tool-groups'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
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
}

export type FeedDocumentContext = {
  stalled: boolean
  activeEvidenceId: string | null
  initialMeasurementsCache?: VirtualItem[] | undefined
  initialScrollPosition?: number | null
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  onMeasurementsChange?: (sessionId: string, measurements: VirtualItem[]) => void
  onOpenSession: (sessionId: string) => void
  onScrollPositionChange: (sessionId: string, position: number) => void
  historyLabel: string
} & FeedQuestionHandlers

export type FeedDocumentProps = {
  reading: SessionFeed
  liveFacts: FeedLiveFacts
  actions: FeedDocumentContext
}

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}
function ignoreMeasurementsChange(_sessionId: string, _measurements: VirtualItem[]) {}

type ToolGroupRow = Extract<SessionFeedRow, { shape: 'tool-group' }>

// The live thought reads once, as the trailing row, so the group it follows lets it go.
function withoutThought(group: ToolGroupRow, text: string): ToolGroupRow {
  const thoughts = group.thoughts ?? []
  return thoughts.at(-1)?.text.trim() === text
    ? { ...group, thoughts: thoughts.slice(0, -1) }
    : group
}

// While the Turn runs, its one activity draws once: a call titles the tail group, and a thought
// is the trailing row. Once the Turn settles neither is drawn, so no live row is left behind.
function liveRows(reading: SessionFeed, facts: NonNullable<FeedLiveFacts>): SessionFeedRow[] {
  const rows = reading.rows
  const activity =
    facts.compactionStartedAt === null && (facts.isRunning || facts.status === 'unknown')
      ? facts.activity
      : null
  if (activity === null) return rows
  const last = rows.at(-1)
  if (last?.shape === 'thought') return rows
  const turnStart = rows.findLastIndex((row) => row.shape === 'prose' && row.role === 'user')
  const tailGroup = last?.shape === 'tool-group' && rows.length - 1 > turnStart ? last : null
  if (activity.kind !== 'thought')
    return tailGroup === null ? rows : [...rows.slice(0, -1), withHeadline(tailGroup, activity)]
  const settled =
    tailGroup === null ? rows : [...rows.slice(0, -1), withoutThought(tailGroup, activity.label)]
  return [
    ...settled,
    { shape: 'thought', id: `${reading.sessionId}:activity`, text: activity.label },
  ]
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

// The selected document owns its virtualized history and scroll state.
export function FeedDocument({ reading, liveFacts, actions }: FeedDocumentProps) {
  const { t } = useTranslation('sessions')
  const onJumpToLatestChange = actions.onJumpToLatestChange ?? ignoreJumpToLatestChange
  const live = liveReading(reading, liveFacts)
  const toolGroups = useRef(new ToolGroupState()).current
  const revealCache = useRef<RevealCache>(new Map()).current
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
  const { column, settled } = useSettledFeed({
    sessionId: live.reading.sessionId,
    revision: live.reading.revision,
    rows: live.reading.rows,
  })
  const reveals = useReveals(settled)
  const lastRow = live.reading.rows.at(-1)
  const tailIsLive = lastRow !== undefined && isFeedRowStreaming(lastRow)
  const streamingRowId = live.isRunning && tailIsLive ? lastRow.id : null
  // A quiet marker keeps its box through prose/tool changes, so the Feed height stays stable (#2241).
  const tail = liveFeedTail(live, lastRow, actions.onOpenSession)
  const content = feedContent({
    initialMeasurementsCache: actions.initialMeasurementsCache ?? NO_MEASUREMENTS,
    initialScrollPosition: actions.initialScrollPosition ?? null,
    settled,
    isRunning: live.isRunning,
    stalled: actions.stalled,
    onJumpToLatestChange,
    onMeasurementsChange: actions.onMeasurementsChange ?? ignoreMeasurementsChange,
    onScrollPositionChange: actions.onScrollPositionChange,
    DrawnRow,
    reveals,
    streamingRowId,
    tail,
    emptyText: [t('empty.blank.title'), t('empty.blank.description')],
    historyLabel: actions.historyLabel,
  })
  return (
    <div className="feed__document" data-active="true" data-revision={settled?.reading.revision}>
      <div className="feed__column" ref={column}>
        {content}
      </div>
    </div>
  )
}
