import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import { foldSettledToolRuns, withHeadline } from '@/domains/sessions/contract/model/tool-groups'
import { useDrawnRow } from '@/domains/sessions/renderer/feed/drawn-row'
import { feedContent } from '@/domains/sessions/renderer/feed/feed-content'
import {
  type FeedLiveFacts,
  INACTIVE_FEED_LIVE_FACTS,
} from '@/domains/sessions/renderer/feed/feed-live-facts'
import { isFeedRowStreaming } from '@/domains/sessions/renderer/feed/feed-row-renderers'
import { liveFeedTail } from '@/domains/sessions/renderer/feed/feed-tail'
import { useReveals } from '@/domains/sessions/renderer/feed/reveal'
import type { RevealCache } from '@/domains/sessions/renderer/feed/streaming-text'
import { ToolGroupState } from '@/domains/sessions/renderer/feed/tool-group-state'
import { useSettledFeed } from '@/domains/sessions/renderer/feed/use-settled-feed'
import type {
  SessionEvidence,
  SessionFeed,
  SessionFeedRow,
} from '@/domains/sessions/renderer/types'
import { sessionPostureLocksAnswer } from '@/domains/sessions/renderer/types'

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
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  onOpenSession: (sessionId: string) => void
} & FeedQuestionHandlers

export type FeedDocumentProps = {
  reading: SessionFeed
  liveFacts: FeedLiveFacts
  actions: FeedDocumentContext
}

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}

// The Feed never draws a thought from the transcript as history. While the Turn runs, the
// Session's activity (the fact the roster draws under the title, a thought or the latest call)
// titles the Turn's tool group; before any tool has run, a thought is its own line. It leaves
// when the Turn ends (#2410), and the compaction marker stands in for it while compaction runs.
function liveRows(reading: SessionFeed, facts: NonNullable<FeedLiveFacts>): SessionFeedRow[] {
  const rows = foldSettledToolRuns(reading.rows.filter((row) => row.shape !== 'thought'))
  const hasTrailingThought = reading.rows.at(-1)?.shape === 'thought'
  const activity =
    facts.compactionStartedAt === null &&
    (facts.isRunning || (facts.activity?.kind === 'thought' && hasTrailingThought))
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
  // A settled prompt stays only while the transcript has no rows, so it can never double one.
  const promptRow =
    facts.optimisticRow ?? (reading.rows.length === 0 ? facts.settledPromptRow : null)
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
  const onOpenSession = actions.onOpenSession
  const live = liveReading(reading, liveFacts)
  const feed = live.reading
  const toolGroups = useRef(new ToolGroupState()).current
  const revealCache = useRef<RevealCache>(new Map()).current
  const revealsFor = useReveals()
  const DrawnRow = useDrawnRow({
    sessionId: feed.sessionId,
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
    sessionId: feed.sessionId,
    revision: feed.revision,
    rows: feed.rows,
    isRunning: live.isRunning,
    stallTimeoutMs: actions.stallTimeoutMs,
  })
  const lastRow = feed.rows[feed.rows.length - 1]
  // A running assistant reply or tool group is the Feed's live tail.
  const tailIsLive = lastRow !== undefined && isFeedRowStreaming(lastRow)
  const streamingRowId = live.isRunning && tailIsLive ? lastRow.id : null
  // A quiet marker keeps its box through prose/tool changes, so the Feed height stays stable (#2241).
  const tail = liveFeedTail(live, lastRow, onOpenSession)
  const content = feedContent({
    active: actions.active,
    settled,
    isRunning: live.isRunning,
    stalled,
    posture: live.posture,
    onRetry: retry,
    onJumpToLatestChange,
    DrawnRow,
    revealsFor,
    streamingRowId,
    tail,
    emptyText: [t('empty.blank.title'), t('empty.blank.description')],
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
