import { type RefObject, useEffect, useRef } from 'react'
import { createEclipseOrb } from '../eclipseOrb'
import type { OrbHandle, OrbState, Rgb } from '../eclipseOrb/types'

/**
 * Parse a CSS colour into the engine's 0–1 RGB tuple; `undefined` if unparseable.
 * Accepts `#rgb` / `#rrggbb` and `rgb()/rgba()` — the two forms Storybook's colour
 * control emits — so a picked colour flows straight to the orb.
 */
function parseColor(color: string | undefined): Rgb | undefined {
  if (!color) return undefined
  const c = color.trim()
  const rgb = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255]
  let h = c.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (h.length !== 6) return undefined
  const n = Number.parseInt(h, 16)
  if (Number.isNaN(n)) return undefined
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export interface UseEclipseOrbOpts {
  /** Voice-state vocabulary — a pure prop; no live signal maps onto it yet. */
  orbState: OrbState
  /** Draw the mountain plate (stage) or not (dock). Fixed for the orb's life. */
  backdrop?: boolean
  /** Rightward pixel offset so the orb centers in the visible gap (stage only). */
  panelShift?: number
  /** Widen the FOV a touch when a side panel is open. */
  fovOpen?: boolean
  /**
   * The one colour the whole orb derives from, as a CSS colour string (hex or
   * `rgb()`). Rim, dot, core and glow are all this base lifted toward white. Omit
   * for the default eclipse blue; the `error` state overrides it with its own red.
   */
  tint?: string
  /**
   * Freeze the render loop. State B (a session detail covering the stage) sets
   * this true; the last frame stays on the canvas. Under reduced motion the orb
   * is always static, so this is inert.
   */
  paused?: boolean
}

/** True when the OS asks for reduced motion — read once at mount (SSR-safe guard). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Mount the three.js eclipse orb on a canvas and drive it from props. The engine
 * is created once (mount) and disposed on unmount; every prop change is pushed
 * through the imperative handle, never by remounting. The handle is IO-free — this
 * hook only ever forwards layout/selection facts, never audio.
 */
export function useEclipseOrb(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  opts: UseEclipseOrbOpts,
): void {
  const handleRef = useRef<OrbHandle | null>(null)
  // Snapshot the opts so the mount effect captures the initial values through a
  // ref, not a stale closure — the per-prop effects below own every later change.
  const initial = useRef(opts)

  // Mount-once: the engine owns a WebGL context that must never be rebuilt on a
  // prop change. `canvasRef` is a stable ref; `initial` snapshots the rest, and the
  // per-prop effects below push every later change through the handle.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once by design — see above.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reducedMotion = prefersReducedMotion()
    const handle = createEclipseOrb(canvas, {
      reducedMotion,
      backdrop: initial.current.backdrop ?? true,
      // Seed the colour at creation so a custom tint has no blue fade-in on mount.
      tint: parseColor(initial.current.tint),
    })
    handleRef.current = handle
    // Sync the initial props onto the fresh handle — the per-prop effects won't
    // fire until their value changes, so an explicit sync is needed at mount.
    handle.setState(initial.current.orbState)
    handle.setPanelShift(initial.current.panelShift ?? 0)
    handle.setFovOpen(initial.current.fovOpen ?? false)
    if (initial.current.paused) handle.pause()
    return () => {
      handleRef.current = null
      handle.destroy()
    }
  }, [])

  useEffect(() => {
    handleRef.current?.setState(opts.orbState)
  }, [opts.orbState])
  useEffect(() => {
    const rgb = parseColor(opts.tint)
    if (rgb) handleRef.current?.setTint(rgb)
  }, [opts.tint])
  useEffect(() => {
    handleRef.current?.setPanelShift(opts.panelShift ?? 0)
  }, [opts.panelShift])
  useEffect(() => {
    handleRef.current?.setFovOpen(opts.fovOpen ?? false)
  }, [opts.fovOpen])
  useEffect(() => {
    if (opts.paused) handleRef.current?.pause()
    else handleRef.current?.resume()
  }, [opts.paused])
}
