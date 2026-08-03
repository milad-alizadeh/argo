import { cn } from '@/lib/utils'
import type { DotGlow, RosterTone } from '@/shared/status'

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
  glow = 'live',
  pulse,
  className,
}: {
  /** Which cockpit tone the dot carries — its fill, its ring and its glow all read it. */
  tone: RosterTone
  /** What the dot means, for a dot that stands alone. Omit it beside a visible word. */
  label?: string
  /** A ring with no fill: how a session Argo only observes renders (registry, External). */
  hollow?: boolean
  /** How hard the halo burns. Every dot glows — a state is never unlit — so this weighs the
   * glow rather than switching it on: `quiet` for a resting state, `faint` for the hollow
   * ring of a session Argo only observes. */
  glow?: DotGlow
  /** Whether the dot breathes. A property of the state it draws — everything live or asking
   * for you does — not a budget: several dots may breathe at once. */
  pulse?: boolean
  className?: string
}): React.JSX.Element {
  const dot = cn(
    'inline-block size-2 shrink-0 rounded-full',
    hollow ? 'border border-current' : 'bg-current',
    `text-tone-${tone}`,
    'glow',
    `glow-${glow}`,
    pulse && 'motion-safe:animate-pulse-status',
    className,
  )
  if (label === undefined) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
