import { cn } from '@/lib/utils'
import {
  CaretDownIcon,
  CaretRightIcon,
  type IconAtom,
  StatusDot,
  Text,
  useDisclosure,
} from '@/shared/components/ui'
import { RowGlyph } from './RowGlyph'
import { BODY_INSET, DISCLOSURE } from './rowRecipes'

// The shell the feed's two LOUD rows share — a change to a file, and a command or a failure.
//
// A LINE, not a card. It was a card, and a card is emphasis: on a real session that meant a hundred
// and ninety-three bordered boxes in one column, which is not emphasis but wallpaper — nothing on
// the surface could out-shout anything else, and the padding alone doubled the feed's height. The
// border now belongs to the BODY (a diff, an output block), which is foreign content that genuinely
// needs a boundary and which is closed by default.
//
// ONE grammar, and only one, across every row this feed draws — the quiet fold included:
//
//   caret · glyph · word · subject     four fixed columns, always present, on every kind of row
//
// No box, no ring, no stub, no per-row exception. What a row IS travels entirely in the COLOUR of
// its glyph and verb — and that colour is the same table the minimap paints from
// (`minimapMatrix.ts`), so the strip on the right is legible for the same reason a chart with a
// legend is: the column beside it IS the legend. Every border tried before this was a second
// channel saying what the ink already said, and each one made the surface a little less uniform to
// buy emphasis the ink was giving away free.

/** The mark a loud row wears: what happened, in the vocabulary of the thing it happened to.
 * The word is rendered AS AUTHORED — sentence case, never uppercased: the verb is the row's own
 * vocabulary, and shouting it back changes what was said. */
export interface RowMark {
  Icon: IconAtom
  word: string
  tone: string
  /** Still going. Rendered as the session's own pulsing run dot beside the verb — the verb itself
   * never changes tense for state. */
  live?: boolean
}

/**
 * Organism: one loud row — a single line, and the body it opens onto.
 *
 * `subject` is the row's own words (a path, a command line), never re-punctuated here: what a row
 * NAMES is the caller's fact, and this shell decides only that it sits on the feed's one column.
 */
export function ToolRow({
  mark,
  subject,
  trailing,
  defaultOpen = false,
  bleed = false,
  children,
}: {
  mark: RowMark
  /** What the row names — the file it changed, or the line it ran. A node rather than a string, so
   * a caller can split it (a path's dirname from its filename) without this shell knowing how. */
  subject: React.ReactNode
  /** Held to the right edge of the line, for the one count a row carries (churn). */
  trailing?: React.ReactNode
  /** Whether the body starts shown. `false` for everything but a PICTURE — a diff, a log and an
   * absence line are all EVIDENCE for what the row's line already told you, so they wait to be
   * asked for; an image is the fact itself, and the one thing a terminal cannot show at all. Same
   * component, same caret, same body slot — this is a starting position, not a second mechanism. */
  defaultOpen?: boolean
  /** Whether the body reaches the box's edges instead of sitting inside its inset.
   *
   * For CONTENT THAT BRINGS ITS OWN COLUMNS — a diff (a line-number gutter, and +/- bands that are
   * only legible as bands if they span the full width) and a picture (whose edge IS its edge). An
   * inset there is padding fighting structure the content already has: it stripes the bands short
   * of the border and leaves the gutter aligned to nothing.
   *
   * Prose has no columns of its own, so it takes the inset and reads down from the row's verb. Same
   * box, same caret, same border either way — this states which kind of thing is inside it, and is
   * the only thing the body slot varies by. */
  bleed?: boolean
  /** Everything the row has to SHOW — a diff, an output block, a picture, a line saying there is
   * none of those. All of it behind the one caret, so a column of fifty calls is fifty lines. A row
   * handed nothing renders inert rather than as a control that opens onto nothing. */
  children?: React.ReactNode
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen })
  const openable = children !== undefined && children !== false && children !== null
  // `null` where there is nothing to open: the cell is still spent, so the column holds, but no
  // caret is drawn on a row that would do nothing if you hit it.
  const line = (
    <RowLine mark={mark} subject={subject} trailing={trailing} open={openable ? open : null} />
  )
  return (
    <div data-component="ToolRow" className="flex flex-col">
      {openable ? (
        // The WHOLE line is the hit target, not the caret on it: the row's own name is what a hand
        // goes to, and a fourteen-pixel glyph beside a full-width row that looks equally clickable
        // is a target you have to aim at.
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(DISCLOSURE, 'w-full')}
        >
          {line}
        </button>
      ) : (
        line
      )}
      {/* THE BOX BELONGS TO THE ROW, not to whatever is inside it.
          Every caller used to bring its own: output arrived in a bordered card, a folded read's list
          arrived bare, a diff arrived in a frame of its own. So two rows you opened side by side did
          not match — which is not a property of output versus reads, it is just three components
          each having decided separately. One container here, and what goes in it is only content. */}
      {openable && open && (
        // `ml-body-inset` is a MARGIN, so the box's own EDGE starts at the glyph column — the block
        // hangs off the icon that names it. As padding it looked the same at first glance and was
        // not: a full-width box with its text pushed in reads as a panel that happens to be indented
        // inside, and its border ran out past the row it belongs to on both sides.
        //
        // `my-gap` on both sides, because a run of tool calls is spaced at ZERO so it reads as one
        // block (`TurnFeed`'s gap rule) — right for a column of closed lines, wrong the moment one
        // opens, when the box would butt against its own row above and the next row below.
        // ONE box, and its horizontal inset is the CONTENT's to state — see `bleed`.
        //
        // Inset, `pl-body-inset` is not the `p-gap` the other sides take. The box's own EDGE is at
        // the glyph column, so a uniform 8px inset started the text between the glyph and the verb —
        // aligned to nothing, a column invented by whatever padding looked right. The left inset is
        // the SAME measure that placed the box (glyph width + one gap), so the first character lands
        // exactly under the row's verb and an open row adds no new left edge to the feed.
        <div
          className={cn(
            'my-gap ml-body-inset flex flex-col gap-gap overflow-hidden rounded-md inset-card py-gap',
            bleed ? '' : BODY_INSET,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** The line itself: caret, mark, verb, subject, and whatever the caller holds to the right.
 *
 * The caret LEADS, in a fixed cell of its own, and that placement is the point. Flush right it sat
 * a full row-width from the thing it opened, so on a column of fifty rows you tracked across to
 * find the one you meant — and above a short subject it was marooned in whitespace with nothing to
 * associate it to. At the head it forms a column with every other row's, which is how a disclosure
 * list has been read since the first file tree. A row with nothing to open still spends the cell,
 * so the marks beside it stay in line. */
function RowLine({
  mark,
  subject,
  trailing,
  open,
}: {
  mark: RowMark
  subject: React.ReactNode
  trailing?: React.ReactNode
  /** `null` where the row opens onto nothing — an empty cell, not a caret. */
  open: boolean | null
}): React.JSX.Element {
  const { Icon, word, tone, live } = mark
  return (
    <div className="flex w-full items-baseline gap-snug text-left">
      <Caret open={open} />
      <RowGlyph Icon={Icon} tone={tone} />
      {/* A COLUMN, not a word followed by a space. `Run`, `Edit`, `Failed` and `Create` are three to
          six characters, so a shrink-wrapped cell started every row's subject at a different x and
          the feed had no left edge to read down — which is the whole point of a fixed mark column
          two cells to the left of it. `6ch` is the longest verb (`Failed`, `Create`, `Delete`) in
          the row's own font, and it is a MINIMUM so the quiet fold's counts — which live in this
          slot and are as long as they need to be — run past it rather than being clipped. */}
      <Text variant="code" className={cn('min-w-[6ch] shrink-0', tone)}>
        {word}
      </Text>
      {live === true && (
        <StatusDot tone="run" glow="live" pulse label="running" className="self-center" />
      )}
      <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-soft">
        {subject}
      </Text>
      {trailing}
    </div>
  )
}

/** The disclosure's state, in the leading cell. Rides inside a `Text` for the same reason
 * `RowGlyph` does: the icon box is em-relative, so a bare icon would size against the body type
 * rather than against the 11px line it marks. */
function Caret({ open }: { open: boolean | null }): React.JSX.Element {
  const Glyph = open === true ? CaretDownIcon : CaretRightIcon
  return (
    <Text
      aria-hidden
      variant="code"
      className="w-mark-col shrink-0 text-center text-foreground-faint"
    >
      {open === null ? null : <Glyph className="icon-mark" />}
    </Text>
  )
}
