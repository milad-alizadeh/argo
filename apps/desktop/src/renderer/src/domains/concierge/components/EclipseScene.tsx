import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { OrbState } from '../eclipseOrb/types'
import { useEclipseOrb } from './useEclipseOrb'

export interface EclipseSceneProps {
  /** Voice-state vocabulary — a pure prop; no live signal maps onto it yet. */
  orbState: OrbState
  /**
   * Rightward pixel offset that drifts the big orb from screen-center into the
   * midpoint of the roster→edge gap. The screen computes it from the roster
   * width; the scene just applies it (parallax via camera drift).
   */
  panelShift?: number
  /** Widen the FOV a touch when a side panel is open. */
  fovOpen?: boolean
  /**
   * The one colour the whole orb derives from, as a CSS colour string (hex or
   * `rgb()`). Rim, ground dot, hot core and horizon glow are all this base lifted
   * toward white. Omit for the default eclipse blue; `error` overrides it with red.
   */
  tint?: string
  /**
   * Freeze the render loop (State B). The stage would be covered by a session
   * detail, so it stops drawing and the last frame stays faintly visible through
   * the frosted glass — the perf contract: only ever one orb animating.
   */
  paused?: boolean
  className?: string
}

/**
 * The persistent full-screen stage: the mountain plate + eclipse orb, mounted as
 * a fixed z-0 backdrop behind the frosted spine (glass over mountains). Dumb and
 * prop-driven — every reactive input is a prop, exercised in Storybook. `aria-hidden`
 * because it is pure ambiance; the Concierge's state word is announced by the dock.
 */
export function EclipseScene({
  orbState,
  panelShift = 0,
  fovOpen = false,
  paused = false,
  tint,
  className,
}: EclipseSceneProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEclipseOrb(canvasRef, { orbState, backdrop: true, panelShift, fovOpen, paused, tint })

  return (
    <div
      aria-hidden
      data-testid="eclipse-scene"
      data-orb-state={orbState}
      data-paused={paused}
      className={cn('fixed inset-0 -z-10 bg-background', className)}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
