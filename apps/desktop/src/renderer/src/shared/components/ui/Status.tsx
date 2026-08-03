import { cn } from '@/lib/utils'
import type { DotGlow, RosterTone } from '@/shared/status'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

/**
 * Molecule: a state as its word plus a dot, in the one order the cockpit uses — word
 * first, dot terminating the row.
 *
 * The DOT carries the state and the word stays neutral: colouring both is the
 * double-encoding the status registry forbids. The dot is decorative here, because the
 * visible word is already the accessible name. A dot with no word beside it is the
 * StatusDot atom, not this.
 */
export function Status({
  word,
  tone,
  hollow,
  glow,
  pulse,
  className,
}: {
  /** The state's word, already derived. A screen reads it off the status vocabulary
   * (`rosterWord()`) — never a word typed at the call site. A molecule whose word is fixed
   * by the design rather than by session state supplies its own. */
  word: string
  /** The tone the dot carries, from the same derivation. It never reaches the word. */
  tone: RosterTone
  /** A ring with no fill, for a session Argo only observes. */
  hollow?: boolean
  /** How hard the dot's halo burns. Every state glows; the weight is its liveness. */
  glow?: DotGlow
  /** Whether the dot breathes — a property of the state, not a budget. */
  pulse?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <Text
      variant="meta"
      className={cn('inline-flex shrink-0 items-center gap-snug text-foreground-soft', className)}
    >
      {word}
      <StatusDot tone={tone} hollow={hollow} glow={glow} pulse={pulse} />
    </Text>
  )
}
