import { cn } from '@/lib/utils'
import { Button, buttonVariants, SparkleIcon, Text, XIcon } from '@/shared/components/ui'

type ConsoleChannelTabProps = {
  /** The channel this tab selects — `live`, or the capture's own id. Reported back through
   * the callbacks so the parent never has to close over it. */
  id: string
  /** What the tab reads: `session · live`, or a timestamped capture (`vitest @12:04`). */
  label: string
  /** This channel is the one the Console is showing. */
  active?: boolean
  /** DOM id of the panel this tab controls, when that panel is on screen. The Console owns
   * both ends; a tab rendered on its own leaves it unset rather than dangling. */
  panelId?: string
  /** Select this channel. */
  onSelect: (id: string) => void
  className?: string
} & (
  | {
      /** The fixed session channel (R13): it is always there, so it carries no ✕. */
      kind: 'live'
    }
  | {
      /** The ONE replaceable slot (R13): closable, and sparkled when an Agent produced it. */
      kind: 'capture'
      /** The feed came from an Agent, so the tab carries the sparkle that marks AI presence. */
      agent?: boolean
      /** Clear the capture slot. */
      onClose: (id: string) => void
    }
)

// Molecule: one channel in the console's strip. The chip is NOT itself a control — it holds
// two (select, close) — so it wears the ladder's quiet chip and hands its semantics off,
// leaving the `role="tab"` as the tablist's direct child.
export function ConsoleChannelTab(props: ConsoleChannelTabProps): React.JSX.Element {
  const { id, label, active = false, panelId, onSelect, className } = props
  // The sparkle and the ✕ belong to a capture alone, so they are read off the union rather
  // than from booleans a caller could set on the fixed channel.
  const capture = props.kind === 'capture' ? props : null

  return (
    <div
      role="presentation"
      data-slot="console-channel-tab"
      data-kind={props.kind}
      data-active={active}
      className={cn(
        buttonVariants({ variant: 'quiet', size: 'sm' }),
        'min-w-0 shrink cursor-default',
        className,
      )}
    >
      <Button
        variant="bare"
        size="none"
        role="tab"
        aria-selected={active}
        aria-controls={panelId}
        onClick={() => onSelect(id)}
        className="min-w-0"
      >
        {capture?.agent === true && <SparkleIcon aria-hidden />}
        <Text variant="meta" className="truncate">
          {label}
        </Text>
      </Button>
      {capture !== null && (
        <Button
          variant="bare"
          size="none"
          title="close this capture"
          aria-label={`Close ${label}`}
          onClick={() => capture.onClose(id)}
          className="text-foreground-faint hover:text-foreground"
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  )
}
