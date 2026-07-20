import { cn } from '@/lib/utils'
import type { RailIcon, RailTone } from '@/ship'
import { RAIL_ICON } from './railIcon'

// Atom: a status row's leading glyph — the ship-named icon, tinted by its tone. The
// name → component lookup lives here alone, so no View re-implements it and the ship
// keeps emitting icon names, never React components.
export function StatusIcon({
  icon,
  tone,
  className,
}: {
  /** The icon name from the ship derivation (`RailStatus.icon`). */
  icon: RailIcon
  /** The tone that names the icon's `--tone-*` colour. */
  tone: RailTone
  className?: string
}): React.JSX.Element {
  const Icon = RAIL_ICON[icon]
  return (
    <Icon
      weight="light"
      aria-hidden
      className={cn('size-4 shrink-0', `text-tone-${tone}`, className)}
    />
  )
}
