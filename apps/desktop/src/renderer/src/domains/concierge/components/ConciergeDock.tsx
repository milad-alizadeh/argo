import { useRef } from 'react'
import { Text } from '@/shared/components/ui'
import type { OrbState } from '../eclipseOrb/types'
import { useEclipseOrb } from './useEclipseOrb'

export interface ConciergeDockProps {
  /** Voice-state vocabulary — a pure prop; no live signal maps onto it yet. */
  orbState: OrbState
  /**
   * Run the mini orb's loop. Only the covered-stage case (State B, a session
   * detail open) sets this true — the perf contract is one orb animating at a
   * time, so when the big stage is live this stays false and the dock orb holds
   * a static frame.
   */
  active?: boolean
}

/**
 * The Concierge dock (issue 134 slot): a mini eclipse orb (real engine, no mountain
 * plate), the "Concierge" label, and the current state word. Lives flat at the
 * foot of the frosted Roster panel — the orb canvas is transparent, so it reads
 * as an inset element, not a second glass layer.
 */
export function ConciergeDock({ orbState, active = false }: ConciergeDockProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEclipseOrb(canvasRef, { orbState, backdrop: false, paused: !active })

  return (
    <div
      data-testid="concierge-dock"
      data-orb-state={orbState}
      className="mt-auto flex items-center gap-2.5 border-t border-border px-3.5 py-3"
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        width={48}
        height={48}
        className="size-6 shrink-0 rounded-full"
      />
      <Text variant="row" className="text-foreground">
        Concierge
      </Text>
      <Text variant="meta" className="ml-auto capitalize text-muted-foreground">
        {orbState}
      </Text>
    </div>
  )
}
