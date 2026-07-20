import { cn } from '@/lib/utils'
import type { RosterTone } from '@/shared/delivery'

/**
 * Atom: a state as a small coloured dot.
 *
 * It is silent unless `label` names it, because a dot beside a visible word must not
 * announce that word twice. A state shown with its word beside it is the Status molecule,
 * not this.
 */
export function StatusDot({
  tone,
  label,
  pulse,
  className,
}: {
  /** Which cockpit tone the dot carries — its fill and its glow both read it. */
  tone: RosterTone
  /** What the dot means, for a dot that stands alone. Omit it beside a visible word. */
  label?: string
  /** Spend the screen's ONE animation budget on this dot. At most one per render. */
  pulse?: boolean
  className?: string
}): React.JSX.Element {
  const dot = cn(
    'inline-block size-2 shrink-0 rounded-full bg-current glow',
    `text-tone-${tone}`,
    pulse && 'motion-safe:animate-pulse-status',
    className,
  )
  if (label === undefined) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
