import { cn } from '@/lib/utils'
import type { SessionView } from '@/sessionStore'
import { Status, StatusIcon, Text } from '@/shared/components/ui'
import { deliveryState } from '@/shared/delivery'

/**
 * Organism: one Session as a flat inset card (the wireframe's `.srow`), now a full-bleed
 * button so the whole row selects the Session.
 *
 * The row's word, tone and icon are derived from the facts main observed — the same
 * `deliveryState` the lifecycle will render, so the two can never disagree — and the atoms below
 * take presentation only. Selection is not the row's to hold: it reports its `id` through
 * `onSelect` and wears the primary tint the screen tells it to.
 */
export function SessionRow({
  session,
  selected = false,
  pulse = false,
  onSelect,
}: {
  /** The one Session this row renders, carrying identity and the raw `facts` main
   * observed. The row grades those facts itself through `deliveryState()` — a pre-rendered
   * word, tone or icon never arrives on the view. */
  session: SessionView
  /** Whether this row is the selected Session — draws the primary-tinted selection card. */
  selected?: boolean
  /** Spend the screen's ONE pulse budget on this row's status dot. The roster grants it to at
   * most one row per render (the top needs-you row, and only while the lifecycle is quiet), so
   * the row only obeys the flag it is handed. */
  pulse?: boolean
  /** Select this Session by its id. The row owns no selection state; it reports the id and
   * the screen above decides. Absent, the row is inert (the roster's read-only stories). */
  onSelect?: (id: string) => void
}): React.JSX.Element {
  const { word, tone, icon } = deliveryState(session.facts).roster
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(session.id)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'w-full rounded-lg border border-inset-hair bg-inset px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          selected && 'border-primary/55 bg-primary/10 hover:bg-primary/10',
        )}
      >
        <div className="flex items-center gap-2">
          <StatusIcon icon={icon} tone={tone} />
          <Text variant="row-strong" className="flex-1 truncate text-foreground">
            {session.title}
          </Text>
          <Status word={word} tone={tone} pulse={pulse} />
        </div>
        <Text as="div" variant="meta" className="mt-1 text-muted-foreground">
          {session.cli}
        </Text>
      </button>
    </li>
  )
}
