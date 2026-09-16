// The markers after the last row: compaction, handoff, and the Turn Marker.
import type { ReactNode } from 'react'
import { CompactionMarker } from './compaction-marker'
import { HandoffCompletedMarker, HandoffMarker } from './handoff-marker'
import { TurnMarker } from './turn-marker'
import type { TurnMarkerView } from './turn-marker-state'

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
