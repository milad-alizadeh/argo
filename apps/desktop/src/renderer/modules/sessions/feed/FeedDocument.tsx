import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeed } from '../types'
import { CompactionMarker } from './CompactionMarker'
import { useDrawnRow, useToolGroups } from './drawn-row'
import { FeedRow } from './FeedRow'
import { feedContent } from './feed-content'
import { HandoffCompletedMarker, HandoffMarker } from './HandoffMarker'
import { useReveals } from './reveal'
import { useSettledFeed } from './useSettledFeed'

type FeedDocumentProps = {
  active: boolean
  activeEvidenceId: string | null
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  handoffStartedAt: string | null
  handoffTo: string | null
  onOpenSession: (sessionId: string) => void
  feed: SessionFeed
  isRunning: boolean
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
}

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
  onOpenSession,
  feed,
  isRunning,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
}: FeedDocumentProps) {
  const { onOpenToolGroup, openToolGroups } = useToolGroups()
  const layoutRevision = `${feed.revision}:${[...openToolGroups].sort().join(':')}`
  const { column, measured, settled } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: layoutRevision,
    contentRevision: feed.revision,
    rows: feed.rows,
  })
  const revealsFor = useReveals()
  const DrawnRow = useDrawnRow({
    sessionId: feed.sessionId,
    activeEvidenceId,
    onOpenEvidence,
    openToolGroups,
    onOpenToolGroup,
    onAnswerQuestion,
    answeringQuestionId,
    questionFailure,
  })
  const content = feedContent({ settled, isRunning, DrawnRow, revealsFor })

  return (
    <div
      className="feed__document"
      data-active={active}
      data-measure-ms={settled?.measuredMs}
      data-revision={settled?.reading.revision}
      data-settle-ms={settled?.settledMs}
      inert={!active}
    >
      <div className="feed__column" ref={column}>
        <div aria-hidden="true" className="feed__measured" ref={measured}>
          {feed.rows.map((row) => (
            <FeedRow
              key={row.id}
              activeEvidenceId={activeEvidenceId}
              onOpenEvidence={onOpenEvidence}
              onOpenToolGroup={onOpenToolGroup}
              openToolGroups={openToolGroups}
              onAnswerQuestion={() => {}}
              answeringQuestionId={null}
              questionFailure={() => null}
              row={row}
            />
          ))}
        </div>
        {content}
        {compactionMarker(compactionStartedAt, compactionPercentage, compactionTokens)}
        {handoffMarker(handoffStartedAt, handoffTo, onOpenSession)}
      </div>
    </div>
  )
}
