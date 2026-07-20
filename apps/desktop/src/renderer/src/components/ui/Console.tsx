import { cn } from '@/lib/utils'
import { ConsoleChannel } from './ConsoleChannel'
import { ConsoleChannelTabs } from './ConsoleChannelTabs'
import {
  type ConsoleCapture,
  type ConsoleLiveChannel,
  LIVE_CHANNEL_ID,
  resolveActiveChannel,
} from './consoleChannels'

type ConsoleProps = {
  /** The session's own channel. Always present — `session · live` is fixed (R13). */
  live: ConsoleLiveChannel
  /** The ONE capture slot. Opening another feed replaces this value; ✕ clears it. */
  capture?: ConsoleCapture
  /** Which channel to show. Naming a capture that is gone shows live. */
  activeChannel: string
  /** The console is at its tall size. Rides through to the strip's control; the height
   * that goes with it is the screen's to hold. */
  expanded: boolean
  /** How tall the console stands, as a CSS length. This is screen-local layout state, NOT
   * a design token: SessionScreen owns the custom property its splitter drives and passes
   * it in (`var(--r-term)`). Nothing here knows that property's name. */
  height: string
  /** Select a channel — `LIVE_CHANNEL_ID`, or the capture's id. */
  onSelectChannel: (id: string) => void
  /** Clear the capture slot. */
  onCloseCapture: (id: string) => void
  /** Swap the console between its two heights. */
  onToggleExpanded: () => void
  className?: string
}

// Organism: the ONE monospace surface (R13). Raw tool and agent feeds fill its single
// capture slot — they never open a pane, and they never nest inside the story pane's prose.
export function Console({
  live,
  capture,
  activeChannel,
  expanded,
  height,
  onSelectChannel,
  onCloseCapture,
  onToggleExpanded,
  className,
}: ConsoleProps): React.JSX.Element {
  const active = resolveActiveChannel(activeChannel, capture)

  // Esc returns to `session · live` from a capture. It is bound here rather than on the
  // window so the console only answers for keys pressed inside it; a screen-wide Esc is
  // the screen's to own.
  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape' || active === LIVE_CHANNEL_ID) return
    event.preventDefault()
    onSelectChannel(LIVE_CHANNEL_ID)
  }

  return (
    // The keydown rides on the region rather than a control of its own: it answers for the
    // focusable channels inside it, so the region takes no role and no tabindex.
    <section
      aria-label="Console"
      data-slot="console"
      data-expanded={expanded}
      onKeyDown={handleKeyDown}
      // Runtime escape hatch: the height is a splitter-driven length the screen owns, so
      // it cannot be a class. See the `height` prop.
      style={{ height }}
      className={cn('flex min-h-0 flex-col border-input border-t', className)}
    >
      <ConsoleChannelTabs
        capture={capture}
        activeChannel={active}
        expanded={expanded}
        onSelectChannel={onSelectChannel}
        onCloseCapture={onCloseCapture}
        onToggleExpanded={onToggleExpanded}
      />
      {capture !== undefined && active === capture.id ? (
        <ConsoleChannel kind="capture" feed={capture.feed} className="flex-1" />
      ) : (
        <ConsoleChannel kind="live" prompt={live.prompt} tail={live.tail} className="flex-1" />
      )}
    </section>
  )
}
