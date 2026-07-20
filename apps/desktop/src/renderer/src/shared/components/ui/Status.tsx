import { cn } from '@/lib/utils'
import type { RailTone } from '@/shared/ship'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

/**
 * Molecule: a state as its word plus a dot, in the one order the cockpit uses — word
 * first, dot terminating the row.
 *
 * The word carries the state and the dot only tints it, so the dot is decorative here and
 * the accessible name is the visible text. A dot with no word beside it is the StatusDot
 * atom, not this.
 */
export function Status({
  word,
  tone,
  pulse,
  className,
}: {
  /** The state's word, already derived. A screen reads it off the ship vocabulary
   * (`SESSION_STATUS` / `railStatus()`) — never a word typed at the call site. A molecule
   * whose word is fixed by the design rather than by session state (NowLine's `live`)
   * supplies its own. */
  word: string
  /** The tone that word carries, from the same derivation. */
  tone: RailTone
  /** Spend the screen's ONE animation budget on this row. At most one per render. */
  pulse?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <Text
      variant="meta"
      className={cn('inline-flex shrink-0 items-center gap-snug', `text-tone-${tone}`, className)}
    >
      {word}
      <StatusDot tone={tone} pulse={pulse} />
    </Text>
  )
}
