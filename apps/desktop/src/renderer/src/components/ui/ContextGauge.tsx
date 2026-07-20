import { cn } from '@/lib/utils'
import { Text } from './Text'

// Atom: the ONE shape for a Session's context window — a labelled bar plus the estimated
// percentage. Rail-only; no other surface repeats it.
export function ContextGauge({
  percentage,
  className,
}: {
  /** Share of the context window used, 0–100. Estimated, so fractions and out-of-range
   * values are expected: the gauge rounds and clamps them. */
  percentage: number
  className?: string
}): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)))
  return (
    <div className={cn('flex items-center gap-snug', className)}>
      <Text variant="tag" className="shrink-0 text-foreground-faint">
        Context
      </Text>
      <span
        role="progressbar"
        aria-label="Context window used"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        title="context window used (estimated)"
        className="h-1 flex-1 rounded-sm bg-border"
      >
        {/* runtime escape hatch: the fill is a percentage of the track, not a token step */}
        <span
          className="block h-full rounded-sm bg-linear-to-r from-primary to-primary-bright text-primary-bright glow"
          style={{ width: `${clamped}%` }}
        />
      </span>
      {/* An estimate reads as plain text — its provenance is the hover tooltip, never
          decoration; a value the tool never reported would dim with text-foreground-faint. */}
      <Text
        variant="meta"
        title="estimated from token usage ÷ model context window"
        className="shrink-0 text-foreground-faint"
      >
        {`~${clamped}%`}
      </Text>
    </div>
  )
}
