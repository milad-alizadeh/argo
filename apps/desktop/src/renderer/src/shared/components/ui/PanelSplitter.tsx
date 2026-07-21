import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

export const PANEL_ORIENTATIONS = ['v', 'h'] as const

/** `v` splits two columns (a vertical bar, dragged left/right); `h` splits two rows. */
export type PanelOrientation = (typeof PANEL_ORIENTATIONS)[number]

/** One spacing-rhythm step per arrow press. A drag-only splitter is unreachable by
 * keyboard, so the same resize runs off the arrow keys. */
const KEY_STEP_PX = 16

/** Panel sizes are px the parent stores: a drag arrives fractional on a retina pointer and
 * runs past both ends, so the splitter rounds and clamps before it reports. */
export function clampPanelSize(size: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(size), min), max)
}

/** The px step an arrow key asks for along this splitter's own axis — 0 for every key
 * that would move across it, which is how the cross-axis arrows stay free for scrolling. */
export function keyStepDelta(key: string, orientation: PanelOrientation): number {
  switch (key) {
    case 'ArrowLeft':
      return orientation === 'v' ? -KEY_STEP_PX : 0
    case 'ArrowRight':
      return orientation === 'v' ? KEY_STEP_PX : 0
    case 'ArrowUp':
      return orientation === 'h' ? -KEY_STEP_PX : 0
    case 'ArrowDown':
      return orientation === 'h' ? KEY_STEP_PX : 0
    default:
      return 0
  }
}

type PanelSplitterProps = {
  /** Which way the bar runs: `v` between two columns, `h` between two rows. */
  orientation: PanelOrientation
  /** Current px size of the panel this splitter resizes — the parent owns it. */
  size: number
  /** Smallest px the panel may shrink to. */
  min: number
  /** Largest px the panel may grow to. */
  max: number
  /** The resized panel sits *after* the splitter (the console under its bar), so dragging
   * toward it shrinks it. */
  invert?: boolean
  /** What this splitter resizes, for assistive tech — "Roster width", "Console height". */
  label: string
  /** The new clamped px size, on every drag step and arrow press. Where that number goes
   * (a screen-local custom property) is the parent's business, never the splitter's. */
  onResize: (size: number) => void
  className?: string
}

/**
 * Atom: the draggable hairline between two panels.
 *
 * It owns the pointer bookkeeping and the clamp, and nothing else — no layout variable, no
 * panel, no persistence. The screen that mounts it decides what the number means.
 */
export function PanelSplitter({
  orientation,
  size,
  min,
  max,
  invert = false,
  label,
  onResize,
  className,
}: PanelSplitterProps): React.JSX.Element {
  const [drag, setDrag] = useState<{ origin: number; size: number } | null>(null)

  useEffect(() => {
    if (drag === null) return
    const axisOf = (event: PointerEvent): number =>
      orientation === 'v' ? event.clientX : event.clientY
    const move = (event: PointerEvent): void => {
      const travelled = axisOf(event) - drag.origin
      onResize(clampPanelSize(drag.size + (invert ? -travelled : travelled), min, max))
    }
    const stop = (): void => setDrag(null)
    // The listeners live on the window so a pointer that outruns the 6px bar — which it
    // always does — keeps resizing until it is released.
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [drag, orientation, invert, min, max, onResize])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    // Without this the drag selects the text in both panels it sits between.
    event.preventDefault()
    setDrag({ origin: orientation === 'v' ? event.clientX : event.clientY, size })
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const step = keyStepDelta(event.key, orientation)
    if (step === 0) return
    event.preventDefault()
    onResize(clampPanelSize(size + (invert ? -step : step), min, max))
  }

  const dragging = drag !== null
  return (
    // The splitter IS the 1px seam between two panes — a single hairline the same width as the
    // panel border, so pane boundaries never double up. It occupies no layout width of its own
    // (`w-0`/`h-0` + a one-side border); the wider grab affordance is the absolutely-placed child,
    // which never pushes the panes apart.
    // biome-ignore lint/a11y/useSemanticElements: <hr> is void, and a window splitter has to take focus and carry aria-valuenow.
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation === 'v' ? 'vertical' : 'horizontal'}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      data-slot="panel-splitter"
      data-dragging={dragging}
      className={cn(
        'group relative shrink-0 touch-none border-border outline-none transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
        orientation === 'v'
          ? 'w-0 cursor-col-resize border-l hover:border-primary'
          : 'h-0 cursor-row-resize border-t hover:border-primary',
        dragging && 'border-primary',
        className,
      )}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      {/* Transparent grab zone, wider than the 1px seam so the divider stays easy to hit —
          absolutely placed so it adds no width and the panes sit flush against the hairline. */}
      <span
        aria-hidden
        className={cn(
          'absolute',
          orientation === 'v' ? 'inset-y-0 -inset-x-snug' : 'inset-x-0 -inset-y-snug',
        )}
      />
    </div>
  )
}
