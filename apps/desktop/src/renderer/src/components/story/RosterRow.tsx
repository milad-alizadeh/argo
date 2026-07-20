import { Text } from '@/components/ui'
import { CaretDownIcon, CaretRightIcon, type IconAtom } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { type AgentState, agentStateWordClass } from './agentState'

export const ROW_CARETS = ['open', 'closed', 'reserved'] as const

/** How a row shows disclosure. `reserved` holds the caret's width without drawing one, so
 * a row with nothing to open still lines its name up with its siblings. */
export type RowCaret = (typeof ROW_CARETS)[number]

export type RosterRowProps = {
  /** Whether the row discloses children, and which way. A row that never discloses has none. */
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
  children,
  className,
}: RosterRowProps): React.JSX.Element {
  const Caret = caret === 'open' ? CaretDownIcon : CaretRightIcon
  return (
    <div
      title={title}
      data-channel-id={channelId}
      className={cn(
        'flex cursor-pointer items-center gap-gap rounded-lg px-gap py-tight hover:bg-foreground/5',
        className,
      )}
    >
      {caret !== undefined && (
        <Text variant="meta" className="inline-flex shrink-0 text-foreground-faint">
          <Caret aria-hidden className={cn(caret === 'reserved' && 'invisible')} />
        </Text>
      )}
      {Glyph !== undefined && (
        <Text variant="row" className="inline-flex shrink-0 text-primary-soft">
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
