import { cn } from '@/lib/utils'
import { type IconAtom, Text } from '@/shared/components/ui'

/**
 * Atom: the feed's mark column — one glyph in one fixed cell.
 *
 * Every row of the feed hangs its mark here, so a turn's rows read as a COLUMN rather than as lines
 * that each start a pixel or two off the last. The cell is a token width and not the glyph's own,
 * because glyphs differ in width and a column measured from its contents is not a column.
 *
 * The icon rides INSIDE a `Text`, which is the whole trick: `--icon-box-sm` is em-relative, so an
 * icon dropped straight into a row would size against the body type rather than against the line it
 * marks.
 */
export function RowGlyph({ Icon, tone }: { Icon: IconAtom; tone: string }): React.JSX.Element {
  return (
    <Text
      aria-hidden
      variant="code"
      className={cn('grid w-mark-col shrink-0 place-items-center', tone)}
    >
      <Icon className="icon-sm" />
    </Text>
  )
}
