import { useLayoutEffect, useRef } from 'react'
import { Icon } from '@/platform/renderer/components/icon/icon'
import { Marker, MarkerContent, MarkerIcon } from '@/platform/renderer/components/ui/marker'
import { formatTurnElapsed } from './elapsed'
import type { TurnMarkerView } from './turn-marker-state'

const PHASE_LABEL: Record<TurnMarkerView['phase'], string> = {
  starting: 'Starting Session',
  resuming: 'Resuming Session',
  working: 'Working',
}

// Fast enough for the tenths the first minute shows.
const TICK_MS = 100
// The counter is outside React's tree, so its story finds it by this mark rather than by a role.
export const TURN_ELAPSED_SLOT = 'turn-elapsed'

// The counter is written into its own element rather than rendered. Ten state updates a second
// re-rendered the marker and everything React drew under it, which made this the largest single
// renderer cost in an idle recording (#2386). The element is `aria-hidden`, so no reader takes the
// elapsed time from the tree.
function useElapsedCounter(startedAt: number) {
  const counter = useRef<HTMLSpanElement>(null)
  // Layout, so the first value is there before the browser paints and the slot never shows empty.
  useLayoutEffect(() => {
    const draw = () => {
      if (counter.current !== null) {
        counter.current.textContent = formatTurnElapsed(Date.now() - startedAt)
      }
    }
    draw()
    const timer = window.setInterval(draw, TICK_MS)
    return () => window.clearInterval(timer)
  }, [startedAt])
  return counter
}

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
  const counter = useElapsedCounter(startedAt)
  return (
    <Marker
      aria-hidden={silent ? 'true' : undefined}
      aria-label={silent ? undefined : PHASE_LABEL[phase]}
      className={`py-2 type-body ${silent ? 'invisible' : ''}`}
      role={silent ? undefined : 'status'}
    >
      {/* A still icon: the shimmering label already moves, and a spinner beside it was two motions. */}
      <MarkerIcon className="text-muted-foreground">
        <Icon name="sparkles" />
      </MarkerIcon>
      {/* Label and counter share one shimmer, in the same muted ink as a settled tool group. */}
      <MarkerContent>
        <span className="feed-work-shimmer inline-flex items-baseline gap-2">
          {PHASE_LABEL[phase]}
          <span
            aria-hidden="true"
            className="tabular-nums"
            data-slot={TURN_ELAPSED_SLOT}
            ref={counter}
          />
        </span>
      </MarkerContent>
    </Marker>
  )
}
