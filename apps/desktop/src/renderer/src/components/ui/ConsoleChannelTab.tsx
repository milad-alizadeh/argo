import { cn } from '@/lib/utils'
import { buttonVariants } from './button'
import type { ConsoleChannelKind } from './consoleChannels'
import { SparkleIcon, XIcon } from './icons'
import { Text, TYPE_ROLE_CLASS } from './Text'

type ConsoleChannelTabProps = {
  /** The channel this tab selects — `live`, or the capture's own id. Reported back through
   * the callbacks so the parent never has to close over it. */
  id: string
  /** What the tab reads: `session · live`, or a timestamped capture (`vitest @12:04`). */
  label: string
  /** `live` is the fixed session channel; `capture` is the one replaceable slot (R13). */
  kind: ConsoleChannelKind
  /** The feed came from an Agent, so the tab carries the sparkle that marks AI presence. */
  agent?: boolean
  /** This channel is the one the Console is showing. */
  active?: boolean
  /** Offer the ✕ that clears the capture slot. `session · live` is fixed: it never closes. */
  closable?: boolean
  /** Select this channel. */
  onSelect: (id: string) => void
  /** Clear the capture slot. Only ever called from the ✕, so only while `closable`. */
  onClose?: (id: string) => void
  className?: string
}

// Molecule: one channel in the console's strip. The chip's box is the control ladder's
// quiet step rather than a bespoke shape, but the chip is NOT itself a <button>: it holds
// two controls (select, close) and nesting one button inside another is invalid. So the
// wrapper wears the chip and hands its own semantics off with `role="presentation"`, which
// leaves the tab as the tablist's direct child in the accessibility tree.
export function ConsoleChannelTab({
  id,
  label,
  kind,
  agent = false,
  active = false,
  closable = false,
  onSelect,
  onClose,
  className,
}: ConsoleChannelTabProps): React.JSX.Element {
  return (
    <div
      role="presentation"
      data-slot="console-channel-tab"
      data-kind={kind}
      data-active={active}
      className={cn(
        buttonVariants({ variant: 'quiet', size: 'sm' }),
        // The strip reads at meta, not at the control ladder's default row-strong — which
        // also sizes the glyph box, since an icon's box is 1em of its own line.
        TYPE_ROLE_CLASS.meta,
        'cursor-default',
        className,
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onSelect(id)}
        className="inline-flex cursor-pointer items-center gap-snug rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        {agent && <SparkleIcon aria-hidden />}
        <Text variant="meta">{label}</Text>
      </button>
      {closable && onClose !== undefined && (
        <button
          type="button"
          title="close this capture"
          aria-label={`Close ${label}`}
          onClick={() => onClose(id)}
          className="inline-flex cursor-pointer rounded-sm text-foreground-faint outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <XIcon aria-hidden />
        </button>
      )}
    </div>
  )
}
