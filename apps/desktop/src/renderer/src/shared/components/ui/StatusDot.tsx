import { cn } from '@/lib/utils'
import type { RosterTone } from '@/shared/status'

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
  hollow,
  glow,
  pulse,
  className,
}: {
  /** Which cockpit tone the dot carries — its fill, its ring and its glow all read it. */
  tone: RosterTone
  /** What the dot means, for a dot that stands alone. Omit it beside a visible word. */
  label?: string
  /** A ring with no fill: how a session Argo only observes renders (registry, External). */
  hollow?: boolean
  /** The live glow. The registry grants it to `running` alone, so it is opt-in: an
   * always-glowing dot spends attention on states that never earned it. */
  glow?: boolean
  /** Spend the screen's ONE animation budget on this dot. At most one per render. */
  pulse?: boolean
  className?: string
}): React.JSX.Element {
  const dot = cn(
    'inline-block size-2 shrink-0 rounded-full',
    hollow ? 'border border-current' : 'bg-current',
    `text-tone-${tone}`,
    // A hollow dot is the absence of a claim about state, so it never glows however it is asked.
    glow && !hollow && 'glow',
    pulse && 'motion-safe:animate-pulse-status',
    className,
  )
  if (label === undefined) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
