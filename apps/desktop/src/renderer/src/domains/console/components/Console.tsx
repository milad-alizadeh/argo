import { useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button, CaretDownIcon, CaretUpIcon, Text } from '@/shared/components/ui'
import { ConsoleChannel } from './ConsoleChannel'
import { ConsoleChannelTab } from './ConsoleChannelTab'
import { type ConsoleCapture, LIVE_CHANNEL_ID, LIVE_CHANNEL_LABEL } from './consoleChannels'
import { LiveTerminal } from './LiveTerminal'
import { resolveActiveChannel } from './resolveActiveChannel'

type ConsoleProps = {
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
  /** Swap the console between its two heights, via the strip's expand control. */
  onToggleExpanded: () => void
  className?: string
}

// Organism: the ONE monospace surface (R13). The live channel is a real shell (`LiveTerminal`);
// raw tool and agent feeds fill its single capture slot — they never open a panel, and they
// never nest inside the Activity panel's prose.
export function Console({
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
  const liveActive = active === LIVE_CHANNEL_ID
  const panelId = useId()
  const panelRef = useRef<HTMLElement>(null)

  // A capture is opened by clicking a timeline row (R13), so focus is OUTSIDE the console
  // when it arrives. Pull it onto the panel, or the Esc the panel promises never reaches
  // the handler below.
  useEffect(() => {
    if (active === LIVE_CHANNEL_ID) return
    panelRef.current?.focus()
  }, [active])

  // Bound on the region rather than the window: the console answers only for keys pressed
  // inside it, and a screen-wide Esc stays the screen's.
  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape' || active === LIVE_CHANNEL_ID) return
    event.preventDefault()
    onSelectChannel(LIVE_CHANNEL_ID)
  }

  return (
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
      {/* The channel strip: the fixed `session · live` tab, at most ONE capture tab (R13), and
          the control that resizes the console. The expand control sits OUTSIDE the tablist —
          only tabs may be a tablist's children. */}
      <div
        data-slot="console-channel-tabs"
        className="flex shrink-0 items-center gap-gap bg-background/55 px-inset py-snug text-muted-foreground"
      >
        <div
          role="tablist"
          aria-label="Console channels"
          className="flex min-w-0 items-center gap-gap"
        >
          <ConsoleChannelTab
            id={LIVE_CHANNEL_ID}
            label={LIVE_CHANNEL_LABEL}
            kind="live"
            active={liveActive}
            panelId={liveActive ? panelId : undefined}
            onSelect={onSelectChannel}
          />
          {capture !== undefined && (
            <ConsoleChannelTab
              id={capture.id}
              label={capture.label}
              kind="capture"
              agent={capture.agent}
              active={!liveActive}
              panelId={liveActive ? undefined : panelId}
              onSelect={onSelectChannel}
              onClose={onCloseCapture}
            />
          )}
        </div>
        <Button
          variant="quiet"
          size="sm"
          aria-expanded={expanded}
          onClick={onToggleExpanded}
          className="ml-auto text-foreground-faint"
        >
          {expanded ? <CaretDownIcon aria-hidden /> : <CaretUpIcon aria-hidden />}
          <Text variant="meta">{expanded ? 'collapse' : 'expand'}</Text>
        </Button>
      </div>
      {capture !== undefined && active === capture.id ? (
        <ConsoleChannel feed={capture.feed} id={panelId} ref={panelRef} className="flex-1" />
      ) : (
        <LiveTerminal id={panelId} className="flex-1" />
      )}
    </section>
  )
}
