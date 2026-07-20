import { cn } from '@/lib/utils'
import { StatusDot } from './StatusDot'
import { STATUS_STATE, STATUS_TONE, type StatusState } from './sessionStatus'

// Molecule: a state as its word plus a dot, in the one order the cockpit uses — word
// first, dot terminating the row. The word carries the state and the dot only tints it,
// so the dot is decorative here and the accessible name is the visible text.
// A dot with no word beside it is the StatusDot atom, not this.
export function Status({
  state,
  pulse,
  className,
}: {
  /** Which state to show. The word and its tone both come from the status vocabulary — a
   * caller never spells a lifecycle word itself. */
  state: StatusState
  /** Spend the screen's ONE animation budget on this row. At most one per render. */
  pulse?: boolean
  className?: string
}): React.JSX.Element {
  const { word, tone } = STATUS_STATE[state]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-snug text-meta',
        STATUS_TONE[tone].textClass,
        className,
      )}
    >
      {word}
      <StatusDot tone={tone} pulse={pulse} />
    </span>
  )
}
