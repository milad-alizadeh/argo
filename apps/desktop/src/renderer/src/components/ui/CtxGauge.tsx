import { cn } from '@/lib/utils'
import { DerivedValue } from './DerivedValue'

// Atom: the ONE shape for a Session's context window — a labelled bar plus the estimated
// percentage. Rail-only; no other surface repeats it.
export function CtxGauge({
  pct,
  className,
}: {
  pct: number
  className?: string
}): React.JSX.Element {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)))
  return (
    <div className={cn('flex items-center gap-snug', className)}>
      <span className="shrink-0 text-tag text-foreground-faint">CTX</span>
      <span
        role="progressbar"
        aria-label="Context window used"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        title="context window used (estimated)"
        className="h-1 flex-1 overflow-hidden rounded-sm bg-border"
      >
        {/* runtime escape hatch: the fill is a percentage of the track, not a token step */}
        <span
          className="block h-full bg-linear-to-r from-primary to-primary-bright"
          style={{ width: `${clamped}%` }}
        />
      </span>
      <DerivedValue
        text={`~${clamped}%`}
        title="estimated from token usage ÷ model context window"
        className="shrink-0 text-meta text-foreground-faint"
      />
    </div>
  )
}
