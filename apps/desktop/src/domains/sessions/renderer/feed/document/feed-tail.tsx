// The markers after the last row: compaction, handoff, and the Turn Marker.
import type { ReactNode } from 'react'
import type { SessionFeed } from '../../types'
import { CompactionMarker } from '../rows/compaction-marker'
import { isFeedToolGroup } from '../rows/feed-row-renderers'
import { HandoffCompletedMarker, HandoffMarker } from '../rows/handoff-marker'
import { TurnMarker } from '../rows/turn-marker'
import type { TurnMarkerView } from '../rows/turn-marker-state'
import type { FeedLiveFacts } from './feed-live-facts'

export function compactionMarker(
  startedAt: string | null,
  percentage: number | null,
  tokens: string | null,
) {
  return startedAt === null ? null : (
    <CompactionMarker percentage={percentage} startedAt={startedAt} tokens={tokens} />
  )
}

export function handoffMarker(
  startedAt: string | null,
  handoffTo: string | null,
  onOpenSession: (sessionId: string) => void,
) {
  if (startedAt !== null) return <HandoffMarker />
  if (handoffTo !== null)
    return <HandoffCompletedMarker onOpenSession={onOpenSession} sessionId={handoffTo} />
  return null
}

export function feedTail({
  compaction,
  handoff,
  turnMarker,
  markerSilent,
}: {
  compaction: ReactNode
  handoff: ReactNode
  turnMarker: TurnMarkerView | null
  markerSilent: boolean
}) {
  if (compaction === null && handoff === null && turnMarker === null) return null
  return (
    <>
      {compaction}
      {handoff}
      {turnMarker === null ? null : (
        <TurnMarker
          phase={turnMarker.phase}
          silent={markerSilent}
          startedAt={turnMarker.startedAt}
        />
      )}
    </>
  )
}

export function liveFeedTail(
  liveFacts: NonNullable<FeedLiveFacts>,
  lastRow: SessionFeed['rows'][number] | undefined,
  onOpenSession: (sessionId: string) => void,
) {
  return feedTail({
    compaction: compactionMarker(
      liveFacts.compactionStartedAt,
      liveFacts.compactionPercentage,
      liveFacts.compactionTokens,
    ),
    handoff: handoffMarker(liveFacts.handoffStartedAt, liveFacts.handoffTo, onOpenSession),
    turnMarker: liveFacts.turnMarker,
    // A shimmering tail already says the agent is working: a tool group, or the thought it is on.
    markerSilent:
      liveFacts.isRunning &&
      lastRow !== undefined &&
      (isFeedToolGroup(lastRow) || lastRow.shape === 'thought') &&
      liveFacts.turnMarker?.phase === 'working',
  })
}
