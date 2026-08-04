import { cn } from '@/lib/utils'
import { type IconAtom, Text } from '@/shared/components/ui'
import { RowGlyph } from './RowGlyph'

// The card the feed's two LOUD rows share — a change to a file, and a command or a failure. One shell
// rather than two, because they are one thing in the design (work you must not be able to scroll past)
// and their only difference is what hangs under the head.

/** The mark a loud row wears: what happened, in the vocabulary of the thing it happened to. */
export interface RowMark {
  Icon: IconAtom
  word: string
  tone: string
  /** A ring around the whole card, for the states worth ringing. Empty for the rest: a surface
   * outlined on every row is a surface with no emphasis left to spend. */
  ring: string
}

/** The ring a failure wears, wherever it lands. Shared so a failed change and a failed command are
 * not two spellings of one state. */
export const FAILED_RING = 'ring-1 ring-inset ring-tone-red/25'

/**
 * Organism: one loud row — its mark and subject on a head, and whatever it has to show beneath.
 *
 * `subject` is the row's own words (a path, a command line), never re-punctuated here: what a row
 * NAMES is the caller's fact, and this shell decides only that it sits on the feed's one column.
 */
export function LoudRow({
  mark,
  subject,
  trailing,
  children,
}: {
  mark: RowMark
  /** What the row names — the file it changed, or the line it ran. */
  subject: string
  /** Held to the right edge of the head, for the one count a row carries (churn). */
  trailing?: React.ReactNode
  /** The row's body: a diff, an output, or a line saying why there is neither. */
  children?: React.ReactNode
}): React.JSX.Element {
  const { Icon, word, tone, ring } = mark
  return (
    <div
      data-component="LoudRow"
      className={cn('flex flex-col gap-tight rounded-md inset-card px-inset py-gap', ring)}
    >
      <div className="flex items-baseline gap-snug">
        <RowGlyph Icon={Icon} tone={tone} />
        <Text variant="code" className={cn('shrink-0 uppercase', tone)}>
          {word}
        </Text>
        <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-soft">
          {subject}
        </Text>
        {trailing}
      </div>
      {children}
    </div>
  )
}
