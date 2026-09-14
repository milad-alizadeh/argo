import type { ClaudeQuestionAnswer } from '@/core/sessions/claude-contract'
import type { SessionEvidence, SessionFeed } from '../types'
import { CompactionMarker } from './CompactionMarker'
import { useDrawnRow, useToolGroups } from './drawn-row'
import { FeedRow } from './FeedRow'
import { feedContent } from './feed-content'
import { HandoffCompletedMarker, HandoffMarker } from './HandoffMarker'
import { useReveals } from './reveal'
import { TurnMarker } from './TurnMarker'
import type { TurnMarkerView } from './turn-marker'
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
  posture: 'managed' | 'external' | null
  turnMarker: TurnMarkerView | null
  onOpenEvidence: (evidence: SessionEvidence) => void
  onAnswerQuestion: (sessionId: string, questionId: string, answers: ClaudeQuestionAnswer[]) => void
  answeringQuestionId: string | null
  questionFailure: (questionId: string) => string | null
  stallTimeoutMs?: number
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

// The hidden measuring pass draws every row with no interaction wired up: it only needs to match
// the drawn layout's geometry, never to answer a click.
function measuredRows(
  feed: SessionFeed,
  groups: Pick<ReturnType<typeof useToolGroups>, 'openToolGroups' | 'onOpenToolGroup'>,
  props: Pick<FeedDocumentProps, 'activeEvidenceId' | 'onOpenEvidence'>,
) {
  return feed.rows.map((row) => (
    <FeedRow
      key={row.id}
      activeEvidenceId={props.activeEvidenceId}
      onOpenEvidence={props.onOpenEvidence}
      onOpenToolGroup={groups.onOpenToolGroup}
      openToolGroups={groups.openToolGroups}
      onAnswerQuestion={() => {}}
      answeringQuestionId={null}
      questionFailure={() => null}
      row={row}
    />
  ))
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
  posture,
  turnMarker,
  onOpenEvidence,
  onAnswerQuestion,
  answeringQuestionId,
  questionFailure,
  stallTimeoutMs,
}: FeedDocumentProps) {
  const { onOpenToolGroup, openToolGroups } = useToolGroups()
  const layoutRevision = `${feed.revision}:${[...openToolGroups].sort().join(':')}`
  const { column, measured, settled, stalled, retry } = useSettledFeed({
    active,
    sessionId: feed.sessionId,
    revision: layoutRevision,
    rows: feed.rows,
    isRunning,
    stallTimeoutMs,
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
  const content = feedContent({
    settled,
    isRunning,
    stalled,
    posture,
    onRetry: retry,
    DrawnRow,
    revealsFor,
  })

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
          {measuredRows(
            feed,
            { openToolGroups, onOpenToolGroup },
            { activeEvidenceId, onOpenEvidence },
          )}
        </div>
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
