/** The orb's voice-state vocabulary and the handle contract the renderer drives. */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

/** Options fixed at creation time — never change over the orb's life. */
export interface OrbOptions {
  /** Honour `prefers-reduced-motion`: paint one static frame, never start the loop. */
  reducedMotion?: boolean
  /**
   * Draw the mountain photo plate behind the orb (default `true`). The full-screen
   * stage sets it on; the roster dock sets it off — a transparent canvas with just
   * the eclipse ring, so a 26px orb isn't the whole mountain range squashed down.
   */
  backdrop?: boolean
}

/**
 * The imperative handle a React wrapper drives. This is the *prop-driven* port —
 * every input is a layout/selection fact, never audio or a machine state. Audio,
 * conversation-mode and hit-testing from the v1 engine are intentionally dropped.
 */
export interface OrbHandle {
  /** Voice-state vocabulary — a pure prop; nothing maps a live signal onto it yet. */
  setState(state: OrbState): void
  /** Shift the orb's apparent center rightward by this many screen pixels (negative = leftward). */
  setPanelShift(pixelOffset: number): void
  /** Animate FOV to the panel-open or panel-closed target defined in sceneConfig. */
  setFovOpen(open: boolean): void
  /** Stop the render loop (State B): a real RAF stop, leaving the last frame frozen on the canvas. */
  pause(): void
  /** Restart the render loop after a `pause()` (no-op under reduced motion). */
  resume(): void
  destroy(): void
}
