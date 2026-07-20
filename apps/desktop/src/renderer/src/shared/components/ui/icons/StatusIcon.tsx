import { cn } from '@/lib/utils'
import type { RosterIcon, RosterTone } from '@/shared/delivery'
import { ROSTER_ICON } from './rosterIcon'

// Atom: a status row's leading glyph — the delivery-derived icon, tinted by its tone. The
// name → component lookup lives here alone, so no View re-implements it and the delivery
// derivation keeps emitting icon names, never React components.
export function StatusIcon({
  icon,
  tone,
  className,
}: {
  /** The icon name from the delivery derivation (`RosterStatus.icon`). */
  icon: RosterIcon
  /** The tone that names the icon's `--tone-*` colour. */
  tone: RosterTone
  className?: string
}): React.JSX.Element {
  const Icon = ROSTER_ICON[icon]
  return (
    <Icon
      weight="light"
      aria-hidden
      className={cn('size-4 shrink-0', `text-tone-${tone}`, className)}
    />
  )
}
