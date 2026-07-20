import { cn } from '@/lib/utils'
import { Button } from './button'
import { ConsoleChannelTab } from './ConsoleChannelTab'
import {
  type ConsoleCapture,
  LIVE_CHANNEL_ID,
  LIVE_CHANNEL_LABEL,
  resolveActiveChannel,
} from './consoleChannels'
import { CaretDownIcon, CaretUpIcon } from './icons'
import { Text, TYPE_ROLE_CLASS } from './Text'

type ConsoleChannelTabsProps = {
  /** The ONE capture slot (R13). A single value, not a list: opening another feed replaces
   * it, so there is no tab to accumulate and nothing to close one by one. */
  capture?: ConsoleCapture
  /** Which channel the Console is showing. A selection naming a capture that is gone
   * falls back to live rather than lighting no tab. */
  activeChannel: string
  /** The console is at its tall size, so the control offers to collapse it. */
  expanded: boolean
  /** Select a channel — `LIVE_CHANNEL_ID`, or the capture's id. */
  onSelectChannel: (id: string) => void
  /** Clear the capture slot. */
  onCloseCapture: (id: string) => void
  /** Swap the console between its two heights. The height itself is the screen's, never
   * the strip's. */
  onToggleExpanded: () => void
  className?: string
}

// Organism: the console's channel strip — the fixed `session · live` tab, at most ONE
// capture tab, and the control that resizes the strip's console.
export function ConsoleChannelTabs({
  capture,
  activeChannel,
  expanded,
  onSelectChannel,
  onCloseCapture,
  onToggleExpanded,
  className,
}: ConsoleChannelTabsProps): React.JSX.Element {
  const active = resolveActiveChannel(activeChannel, capture)
  return (
    <div
      role="tablist"
      aria-label="Console channels"
      data-slot="console-channel-tabs"
      className={cn(
        'flex shrink-0 items-center gap-gap bg-background/55 px-inset py-snug text-muted-foreground',
        className,
      )}
    >
      <ConsoleChannelTab
        id={LIVE_CHANNEL_ID}
        label={LIVE_CHANNEL_LABEL}
        kind="live"
        active={active === LIVE_CHANNEL_ID}
        onSelect={onSelectChannel}
      />
      {capture !== undefined && (
        <ConsoleChannelTab
          id={capture.id}
          label={capture.label}
          kind="capture"
          agent={capture.agent}
          active={active === capture.id}
          closable
          onSelect={onSelectChannel}
          onClose={onCloseCapture}
        />
      )}
      <Button
        variant="quiet"
        size="sm"
        aria-expanded={expanded}
        onClick={onToggleExpanded}
        className={cn(TYPE_ROLE_CLASS.meta, 'ml-auto text-foreground-faint')}
      >
        {expanded ? <CaretDownIcon aria-hidden /> : <CaretUpIcon aria-hidden />}
        <Text variant="meta">{expanded ? 'collapse' : 'expand'}</Text>
      </Button>
    </div>
  )
}
