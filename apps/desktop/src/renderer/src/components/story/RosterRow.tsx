import { Button, Text } from '@/components/ui'
import { CaretDownIcon, CaretRightIcon, type IconAtom } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { type AgentState, agentStateWordClass } from './agentState'

export const ROW_CARETS = ['open', 'closed', 'reserved'] as const

/** How a row shows disclosure. `reserved` holds the caret's width without drawing one, so
 * a row with nothing to open still lines its name up with its siblings. */
export type RowCaret = (typeof ROW_CARETS)[number]

export type RosterRowProps = {
  /** Whether the row discloses children, and which way. A row that never discloses has none.
   * `reserved` is never interactive, even when `onToggle` is passed — there is nothing to open. */
  caret?: RowCaret
  /** The Actor's leading glyph. A Phase is a grouping rather than an Actor, so it has none. */
  glyph?: IconAtom
  /** The row's native tooltip. */
  title?: string
  /** The console channel this row's Actor streams to. Lands as `data-channel-id`, which is
   * what the seam above binds console selection to. */
  channelId?: string
  /** The state word in the trailing meta unit, already decided by the row — a row omits it
   * where an enclosing rollup has already said it. */
  stateWord?: AgentState
  /** How long the Actor has been running, or ran for. */
  duration?: string
  /** Flips the row's disclosure. Present together with `toggleLabel` whenever `caret` isn't
   * `reserved` — that's what turns the caret into a real button instead of a decorative glyph. */
  onToggle?: () => void
  /** What "Expand"/"Collapse" is a name for — the toggle button's accessible name. Required
   * whenever `onToggle` is passed. */
  toggleLabel?: string
  /** The row's naming middle: name, descriptor and whatever the row reports inline. */
  children: React.ReactNode
  className?: string
}

// Molecule: the roster's one row shape — caret, glyph, naming middle, trailing meta unit.
// Every glyph takes its size from the type role it sits in rather than a pixel box, so the
// row's icons track its text (the study's `.ic{width:1em}` inside a sized span).
export function RosterRow({
  caret,
  glyph: Glyph,
  title,
  channelId,
  stateWord,
  duration,
  onToggle,
  toggleLabel,
  children,
  className,
}: RosterRowProps): React.JSX.Element {
  const Caret = caret === 'open' ? CaretDownIcon : CaretRightIcon
  const canToggle = caret !== undefined && caret !== 'reserved' && onToggle !== undefined
  return (
    <div
      title={title}
      data-channel-id={channelId}
      className={cn(
        'flex cursor-pointer items-center gap-gap rounded-lg px-gap py-tight hover:bg-foreground/5',
        className,
      )}
    >
      {caret !== undefined && canToggle && (
        <Button
          type="button"
          onClick={(event) => {
            // The row itself will gain its own click behaviour (#30, selecting the console
            // channel) — the caret's click must not also fire that.
            event.stopPropagation()
            onToggle?.()
          }}
          aria-expanded={caret === 'open'}
          aria-label={`${caret === 'open' ? 'Collapse' : 'Expand'} ${toggleLabel}`}
          // The caret must be exactly the marker box — no border, no background, no padding.
          // Button's `size="default"` bakes in `px-inset py-snug` via a custom spacing token
          // that tailwind-merge can't see to strip (only classes it knows are de-duped), so a
          // plain `p-0` would land beside it and lose the cascade. `p-0!` forces it to zero.
          className="h-auto w-marker-col shrink-0 justify-center border-0 bg-transparent p-0! text-meta text-foreground-faint hover:bg-transparent hover:text-foreground"
        >
          <Caret aria-hidden />
        </Button>
      )}
      {caret !== undefined && !canToggle && (
        <Text
          variant="meta"
          className="inline-flex w-marker-col shrink-0 justify-center text-foreground-faint"
        >
          <Caret aria-hidden className={cn(caret === 'reserved' && 'invisible')} />
        </Text>
      )}
      {Glyph !== undefined && (
        <Text
          variant="row"
          className="inline-flex w-marker-col shrink-0 justify-center text-primary-soft"
        >
          <Glyph aria-hidden />
        </Text>
      )}
      {children}
      <span className="flex-1" />
      {(stateWord !== undefined || duration !== undefined) && (
        // The state word and the duration read as one faint column, with the row's only
        // state hue sitting on the word.
        <span className="inline-flex shrink-0 items-baseline gap-tight text-foreground-faint">
          {stateWord !== undefined && (
            <Text variant="meta" className={agentStateWordClass(stateWord)}>
              {stateWord}
            </Text>
          )}
          {duration !== undefined && <Text variant="meta">{duration}</Text>}
        </span>
      )}
    </div>
  )
}
