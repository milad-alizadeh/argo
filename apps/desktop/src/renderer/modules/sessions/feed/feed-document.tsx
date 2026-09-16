import { useRef } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeed } from '../types'
import { sessionPostureLocksAnswer } from '../types'
import { useDrawnRow } from './drawn-row'
import { feedContent } from './feed-content'
import { type FeedLiveFacts, INACTIVE_FEED_LIVE_FACTS } from './feed-live-facts'
import { liveFeedTail } from './feed-tail'
import { useReveals } from './reveal'
import type { RevealCache } from './streaming-text'
import { ToolGroupState } from './tool-group-state'
import { useSettledFeed } from './use-settled-feed'

// Shared by FeedDocument and BasicFeed's own prop type, so the two don't drift out of sync.
export type FeedQuestionHandlers = {
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs?: number
}

export type FeedDocumentActions = {
  active: boolean
  activeEvidenceId: string | null
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  onOpenSession: (sessionId: string) => void
} & FeedQuestionHandlers

export type FeedDocumentProps = {
  reading: SessionFeed
  liveFacts: FeedLiveFacts
  actions: FeedDocumentActions
}

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}

function liveReading(reading: SessionFeed, liveFacts: FeedLiveFacts) {
  const facts = liveFacts ?? INACTIVE_FEED_LIVE_FACTS
  const readingWithOptimisticRow =
    facts.optimisticRow === null
      ? reading
      : {
          ...reading,
          revision: `${reading.revision}:${facts.optimisticRow.id}`,
          rows: [...reading.rows, facts.optimisticRow],
        }
  return { ...facts, reading: readingWithOptimisticRow }
}

// A kept document remains mounted when another Session is selected, retaining that Session's
// scroller state until the reader returns (#1834).
export function FeedDocument({ reading, liveFacts, actions }: FeedDocumentProps) {
  const onJumpToLatestChange = actions.onJumpToLatestChange ?? ignoreJumpToLatestChange
  const onOpenSession = actions.onOpenSession
  const stallTimeoutMs = actions.stallTimeoutMs
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
    stallTimeoutMs,
  })
  const lastRow = feed.rows[feed.rows.length - 1]
  // A running assistant reply or tool group is the Feed's live tail.
  const tailIsLive =
    lastRow?.shape === 'tool-group' || (lastRow?.shape === 'prose' && lastRow.role === 'assistant')
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
