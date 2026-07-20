import type { RailTone } from '@/ship'

// tone → its Tailwind colour utility. The token is now named for the tone, so this reads
// as an identity — but it stays an explicit, enumerated map on purpose: the colour reaches
// the screen as a static class per `design-system.md` ("swap classes, never inline styles"
// / no arbitrary values), and Tailwind v4's scanner only emits a `text-tone-*` class it can
// see as a literal here. A `var(--tone-${tone})` interpolation would need an inline style
// that rule forbids, or a runtime-built class the scanner never generates.
export const STATUS_TONE: Record<RailTone, string> = {
  run: 'text-tone-run',
  amber: 'text-tone-amber',
  mist: 'text-tone-mist',
  gray: 'text-tone-gray',
  red: 'text-tone-red',
  stale: 'text-tone-stale',
  landed: 'text-tone-landed',
}
