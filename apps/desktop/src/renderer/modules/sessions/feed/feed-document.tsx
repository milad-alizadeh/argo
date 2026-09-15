import { useRef } from 'react'
import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeed } from '../types'
import { sessionPostureLocksAnswer } from '../types'
import { CompactionMarker } from './compaction-marker'
import { useDrawnRow } from './drawn-row'
import { feedContent } from './feed-content'
import { HandoffCompletedMarker, HandoffMarker } from './handoff-marker'
import { useReveals } from './reveal'
import type { RevealCache } from './streaming-text'
import { ToolGroupState } from './tool-group-state'
import { TurnMarker } from './turn-marker'
import type { TurnMarkerView } from './turn-marker-state'
import { useSettledFeed } from './use-settled-feed'

// Shared by FeedDocument and BasicFeed's own prop type, so the two don't drift out of sync.
export type FeedQuestionHandlers = {
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs?: number
}

type FeedDocumentProps = {
  active: boolean
  activeEvidenceId: string | null
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  handoffStartedAt: string | null
  handoffTo: string | null
  onJumpToLatestChange?: (sessionId: string, action: (() => void) | null) => void
  onOpenSession: (sessionId: string) => void
  feed: SessionFeed
  isRunning: boolean
  posture: 'managed' | 'external' | null
  turnMarker: TurnMarkerView | null
} & FeedQuestionHandlers

function ignoreJumpToLatestChange(_sessionId: string, _action: (() => void) | null) {}

function compactionMarker(
  startedAt: string | null,
  percentage: number | null,
  tokens: string | null,
) {
  return startedAt === null ? null : (
    <CompactionMarker percentage={percentage} startedAt={startedAt} tokens={tokens} />
  )
}

function handoffMarker(
  startedAt: string | null,
  handoffTo: string | null,
  onOpenSession: (sessionId: string) => void,
) {
  if (startedAt !== null) return <HandoffMarker />
  if (handoffTo !== null)
    return <HandoffCompletedMarker onOpenSession={onOpenSession} sessionId={handoffTo} />
  return null
}

// A kept document remains mounted when another Session is selected, retaining that Session's
// scroller state until the reader returns (#1834).
export function FeedDocument({
  active,
  activeEvidenceId,
  compactionStartedAt,
  compactionPercentage,
  compactionTokens,
  handoffStartedAt,
  handoffTo,
  onJumpToLatestChange = ignoreJumpToLatestChange,
  onOpenSession,
  feed,
  isRunning,
  posture,
  turnMarker,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  stallTimeoutMs,
}: FeedDocumentProps) {
  const toolGroups = useRef(new ToolGroupState()).current
  const revealCache = useRef<RevealCache>(new Map()).current
  const { column, settled, stalled, retry } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: feed.revision,
    rows: feed.rows,
    isRunning,
    stallTimeoutMs,
  })
  const revealsFor = useReveals()
  const DrawnRow = useDrawnRow({
    sessionId: feed.sessionId,
    activeEvidenceId,
    onOpenEvidence,
    toolGroups,
    revealCache,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
    questionLocked: sessionPostureLocksAnswer(posture),
  })
  const lastRow = feed.rows[feed.rows.length - 1]
  const streamingRowId =
    isRunning && lastRow?.shape === 'prose' && lastRow.role === 'assistant' ? lastRow.id : null
  const content = feedContent({
    active,
    settled,
    isRunning,
    stalled,
    posture,
    onRetry: retry,
    onJumpToLatestChange,
    DrawnRow,
    revealsFor,
    streamingRowId,
  })

  return (
    <div
      className="feed__document"
      data-active={active}
      data-revision={settled?.reading.revision}
      inert={!active}
    >
      <div className="feed__column" ref={column}>
        {content}
        {compactionMarker(compactionStartedAt, compactionPercentage, compactionTokens)}
        {handoffMarker(handoffStartedAt, handoffTo, onOpenSession)}
        {turnMarker === null ? null : (
          <TurnMarker phase={turnMarker.phase} startedAt={turnMarker.startedAt} />
        )}
      </div>
    </div>
  )
}
