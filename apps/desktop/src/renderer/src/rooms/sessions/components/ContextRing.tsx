import { cn } from '@/lib/utils'
import { Text } from '@/shared/components/ui'

// The ring's geometry lives in the SVG's own unitless coordinate space, not in CSS pixels: the box
// is sized by `size-context-ring` and the drawing scales into it. Named constants rather than bare
// numbers inline, per the design system's non-token-surface clause.
const VIEWBOX = 100
const CENTRE = VIEWBOX / 2
const RADIUS = 44
const STROKE = 6
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** A context percentage is an estimate, so it arrives fractional and can overshoot both ends; the
 * ring shows a whole number inside 0–100. */
export function clampPercentage(percentage: number): number {
  return Math.min(100, Math.max(0, Math.round(percentage)))
}

/**
 * Atom: the ONE shape for a Session's context window — a large ring whose arc is the estimate and
 * whose centre reads it.
 *
 * With no percentage the ring draws **no arc at all** and reads `unknown`, which is how an external
 * session renders: an estimate is never dressed as a measurement, and a full-looking empty ring
 * would be worse than saying nothing. The tilde on the number is the same promise in miniature.
 */
export function ContextRing({
  percentage,
  className,
}: {
  /** Share of the context window in use, 0–100. `null` draws the empty ring and reads `unknown` —
   * the honest rendering for a context Argo cannot establish. */
  percentage: number | null
  className?: string
}): React.JSX.Element {
  const clamped = percentage === null ? null : clampPercentage(percentage)
  const label = clamped === null ? 'context unknown' : `context ${clamped}% used (estimated)`
  return (
    <div
      className={cn('relative grid size-context-ring shrink-0 place-items-center', className)}
      role="img"
      aria-label={label}
    >
      {/* The wrapper above carries the accessible name and this drawing is hidden, so the title below
          is never announced twice — it is there because every svg has to name itself. */}
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} aria-hidden className="absolute inset-0 size-full">
        <title>Context ring</title>
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-border"
        />
        {clamped !== null && (
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
            // Runtime escape hatch: the arc's length is a share of the circumference, which is a
            // computed geometry value and not a token step.
            style={{ strokeDasharray: `${(clamped / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}` }}
            className="stroke-primary text-primary glow"
          />
        )}
      </svg>
      <div className="flex flex-col items-center">
        <Text variant="meta" className="text-foreground">
          {clamped === null ? '—' : `~${clamped}%`}
        </Text>
        <Text variant="tag" className="text-foreground-faint">
          {clamped === null ? 'unknown' : 'ctx'}
        </Text>
      </div>
    </div>
  )
}
