import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Marker, MarkerContent, MarkerIcon } from '../../../components/ui/marker'
import { formatElapsed } from './elapsed'
import type { TurnMarkerView } from './turn-marker'

const PHASE_LABEL: Record<TurnMarkerView['phase'], string> = {
  starting: 'Starting Session',
  resuming: 'Resuming Session',
  thinking: 'Thinking',
  working: 'Working',
}

// The Turn Marker (#2099): what a running Turn is doing right now, with a live elapsed-time
// counter that keeps counting across a phase change, because it is keyed on when the Turn
// started, not on the phase showing it.
export function TurnMarker({ phase, startedAt }: TurnMarkerView) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <Marker className="py-2 type-body" role="status">
      <MarkerIcon>
        <LoaderCircle className="animate-spin" />
      </MarkerIcon>
      <MarkerContent>
        <span className="font-medium text-foreground">{PHASE_LABEL[phase]}</span>
      </MarkerContent>
      <span aria-hidden="true" className="ml-auto type-meta text-muted-foreground tabular-nums">
        {formatElapsed(now - startedAt)}
      </span>
    </Marker>
  )
}
