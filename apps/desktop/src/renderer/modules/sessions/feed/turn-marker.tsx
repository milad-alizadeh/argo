import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Marker, MarkerContent, MarkerIcon } from '../../../components/ui/marker'
import { formatTurnElapsed } from './elapsed'
import type { TurnMarkerView } from './turn-marker-state'

const PHASE_LABEL: Record<TurnMarkerView['phase'], string> = {
  starting: 'Starting Session',
  resuming: 'Resuming Session',
  working: 'Working',
}

// Fast enough for the tenths the first minute shows.
const TICK_MS = 100

// The Turn Marker (#2099): what a running Turn is doing right now, with a live elapsed-time
// counter that keeps counting across a phase change, because it is keyed on when the Turn
// started, not on the phase showing it.
// `silent` keeps the marker's box while a live tail tool group says the same thing in its own
// shimmer. Unmounting it instead changed the Feed's height every time the running Turn moved
// between prose and a tool call, which the reader saw as a jump (#2241).
export function TurnMarker({
  phase,
  startedAt,
  silent = false,
}: TurnMarkerView & { silent?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <Marker
      aria-hidden={silent ? 'true' : undefined}
      aria-label={silent ? undefined : PHASE_LABEL[phase]}
      className={`py-2 type-body ${silent ? 'invisible' : ''}`}
      role={silent ? undefined : 'status'}
    >
      <MarkerIcon>
        <LoaderCircle className="animate-spin" />
      </MarkerIcon>
      <MarkerContent className="flex items-baseline gap-2">
        <span className="feed-work-shimmer">{PHASE_LABEL[phase]}</span>
        <span aria-hidden="true" className="text-muted-foreground tabular-nums">
          {formatTurnElapsed(now - startedAt)}
        </span>
      </MarkerContent>
    </Marker>
  )
}
