import { ConciergeCaption } from './ConciergeCaption'
import { OrbMini } from './OrbMini'

/**
 * Organism: the Concierge's seat in the bar — the orb and its caption, side by side.
 *
 * A seat and nothing more. It owns no behaviour, no conversation-mode toggle and no counters:
 * global chrome holds no permanent seat for an undesigned subsystem, and the Concierge's
 * behaviour and data model belong to the voice-concierge map (issue 190).
 */
export function ConciergeStrip({
  caption,
}: {
  /** What the Concierge is saying, or `null` when it is silent. */
  caption: string | null
}): React.JSX.Element {
  return (
    <div data-component="ConciergeStrip" className="flex min-w-0 items-center gap-inset">
      <OrbMini />
      <ConciergeCaption caption={caption} />
    </div>
  )
}
