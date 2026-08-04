import { cn } from '@/lib/utils'
import { type IconAtom, Text } from '@/shared/components/ui'

/**
 * Atom: the feed's mark column — one glyph in one fixed cell.
 *
 * Every row of the feed hangs its mark here, so a turn's rows read as a COLUMN rather than as lines
 * that each start a pixel or two off the last. The cell is a token width and not the glyph's own,
 * because glyphs differ in width and a column measured from its contents is not a column.
 *
 * The icon rides INSIDE a `Text`, which is the whole trick: `--icon-box-mark` is em-relative, so an
 * icon dropped straight into a row would size against the body type rather than against the line it
 * marks.
 *
 * `icon-mark` and not `icon-sm`: these rows are set in the 11px `code` role, where the `sm` box
 * lands under ten pixels — and the mark is the thing you read BEFORE the text, so it is the one
 * glyph on the surface that cannot afford to be the smallest.
 *
 * The cell centres by TEXT ALIGNMENT rather than by `grid place-items-center`, which is what makes
 * the baseline nudge apply at all: a grid item takes its baseline from its own bottom edge and
 * ignores `vertical-align` outright, so a grid cell hung the glyph off the text baseline and left the
 * larger box floating a few pixels above the line it marks.
 */
export function RowGlyph({ Icon, tone }: { Icon: IconAtom; tone: string }): React.JSX.Element {
  return (
    <Text aria-hidden variant="code" className={cn('w-mark-col shrink-0 text-center', tone)}>
      <Icon className="icon-mark" />
    </Text>
  )
}
