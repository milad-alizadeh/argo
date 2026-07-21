import type { SessionView } from '@/sessionStore'
import { Status, StatusIcon, Text } from '@/shared/components/ui'
import { deliveryState } from '@/shared/delivery'

/**
 * Organism: one Session as a flat inset card (the wireframe's `.srow`).
 *
 * The row's word, tone and icon are derived from the facts main observed — the same
 * `deliveryState` the lifecycle will render, so the two can never disagree — and the atoms below
 * take presentation only. The CLI sits on the meta line; richer per-row data (context %,
 * tokens, elapsed) arrives with later tickets.
 */
export function SessionRow({
  session,
}: {
  /** The one Session this row renders, carrying identity and the raw `facts` main
   * observed. The row grades those facts itself through `deliveryState()` — a pre-rendered
   * word, tone or icon never arrives on the view. */
  session: SessionView
}): React.JSX.Element {
  const { word, tone, icon } = deliveryState(session.facts).roster
  return (
    <li className="rounded-lg border border-inset-hair bg-inset px-3 py-2 transition-colors hover:bg-accent">
      <div className="flex items-center gap-2">
        <StatusIcon icon={icon} tone={tone} />
        <Text variant="row-strong" className="flex-1 truncate text-foreground">
          {session.title}
        </Text>
        <Status word={word} tone={tone} />
      </div>
      <Text as="div" variant="meta" className="mt-1 text-muted-foreground">
        {session.cli}
      </Text>
    </li>
  )
}
