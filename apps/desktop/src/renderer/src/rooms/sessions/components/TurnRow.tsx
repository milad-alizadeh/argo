import { cn } from '@/lib/utils'
import { CaretDownIcon, CaretRightIcon, Text, useDisclosure } from '@/shared/components/ui'
import { turnWord } from '../activityStates'
import type { TimelineTurnModel } from '../interiorActivity'
import { CompactionMarker } from './CompactionMarker'
import { DISCLOSURE, NAV_ROW_SELECTED, TURN_CARD, TURN_CARD_PAST } from './rowRecipes'
import { ToolCallRow } from './ToolCallRow'

// What a folded turn says about itself instead of its steps: how much work is inside it.
const foldedSummary = (turn: TimelineTurnModel): string =>
  `${turn.steps.length} ${turn.steps.length === 1 ? 'tool' : 'tools'}`

/** What the card says about itself at its right edge: the live turn's state, or a folded turn's weight.
 * A past card's stop reason is the least interesting fact about it, and spending the row's right edge on
 * `END_TURN` says nothing a reader came for. */
function CardState({ turn, open }: { turn: TimelineTurnModel; open: boolean }): React.JSX.Element {
  if (!open) {
    return (
      <Text variant="tag" className="shrink-0 text-foreground-faint">
        {foldedSummary(turn)}
      </Text>
    )
  }
  return (
    <Text
      variant="eyebrow"
      className={`shrink-0 ${turn.open ? 'text-tone-run' : 'text-foreground-faint'}`}
    >
      {turnWord(turn.stopReason)}
    </Text>
  )
}

/**
 * The card's header: TWO controls in one row, deliberately.
 *
 * They were one, and it read as a single confused gesture — a click took you to the turn and hid what it
 * had just taken you to. The caret alone folds; everything to the right of it navigates. That is also the
 * ordinary shape of a tree row, so neither half needs explaining once they are separate.
 */
function CardHeader({
  turn,
  open,
  toggle,
  holdsActive,
  onSelect,
}: {
  turn: TimelineTurnModel
  open: boolean
  toggle: () => void
  holdsActive: boolean
  onSelect?: (key: string) => void
}): React.JSX.Element {
  const Caret = open ? CaretDownIcon : CaretRightIcon
  return (
    <div className="flex w-full items-center gap-snug px-inset py-gap">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${open ? 'fold' : 'unfold'} turn ${turn.ordinal}`}
        className={cn(DISCLOSURE, 'shrink-0 rounded-sm hover:bg-foreground/6')}
      >
        {/* The one gold thing inside the card. Inside a `Text` so the em-relative icon box tracks the
            row it opens rather than the 15px body — see PlanProgress for the same trick. */}
        <Text aria-hidden variant="row" className="grid w-mark-col place-items-center text-primary">
          <Caret className="icon-sm" />
        </Text>
      </button>
      <button
        type="button"
        aria-current={holdsActive ? 'true' : undefined}
        onClick={() => onSelect?.(turn.key)}
        className={cn(DISCLOSURE, 'flex min-w-0 flex-1 items-center gap-snug')}
      >
        {/* The prompt names the exchange, so it takes the width; the ordinal only says where in the
            session you are. A turn with no prompt in the record keeps the number alone. */}
        <Text variant="row" className="shrink-0 tabular-nums text-foreground-faint">
          {turn.ordinal}
        </Text>
        {/* No time on the turn itself. A turn is a bookkeeping seam — where one prompt ended and the
            next began — and timing the seam says nothing you can act on. The times worth reading are
            one level in (each call's own clock time) and one level out (the session's duration). */}
        {turn.promptLine === null ? (
          <span className="flex-1" />
        ) : (
          <Text variant="row" className="min-w-0 flex-1 truncate text-left text-foreground">
            {turn.promptLine}
          </Text>
        )}
        <CardState turn={turn} open={open} />
      </button>
    </div>
  )
}

/**
 * Molecule: one Turn in the timeline — its ordinal, its stop reason, and its tool calls.
 *
 * The open turn is expanded and past turns fold, because what a session is doing now is what you
 * came to see. Folding is the row's own business, which is why it holds that state rather than
 * taking it. A folded turn reports its weight rather than going silent, so the history above the
 * open turn still reads as work that happened.
 */
export function TurnRow({
  turn,
  activeKey,
  onSelect,
}: {
  /** The turn, already derived. */
  turn: TimelineTurnModel
  /** Which item the detail feed is showing, tracked by scroll-spy. */
  activeKey: string | null
  /** Jump the detail feed to this turn's section. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: turn.open })
  // The turn card wears the selection for its whole section — for its own anchor, and for any row
  // anchor inside it. A card that went dark while the reader was inside one of its rows would leave the
  // list with no highlight at all for most of a long turn.
  const holdsActive = turn.key === activeKey || turn.steps.some((step) => step.key === activeKey)
  return (
    <li data-component="TurnRow" className="flex flex-col gap-tight">
      {/* The mark sits BEFORE this turn in time, and the list runs oldest first — so it renders
          ABOVE the turn it precedes. Below it would claim the history was condensed after the work
          it actually came before. */}
      {turn.compactedBefore && <CompactionMarker />}
      <div className={cn(open ? TURN_CARD : TURN_CARD_PAST, holdsActive && NAV_ROW_SELECTED)}>
        <CardHeader
          turn={turn}
          open={open}
          toggle={toggle}
          holdsActive={holdsActive}
          onSelect={onSelect}
        />
        {open && (
          <div className="flex flex-col gap-region px-inset pb-inset">
            {turn.steps.length > 0 && (
              // No header over the calls. An unfolded card holds one list, and a heading that names
              // the only thing under it just counts what the rows already show — the folded card is
              // where the weight is worth a number, because there the rows are not there to count.
              <div className="flex flex-col gap-tight">
                <ul aria-label="Tool calls" className="-mx-tight flex flex-col">
                  {turn.steps.map((step) => (
                    // A step jumps to its OWN row in the feed: it carries that row's key, so a folded
                    // run of twelve reads is one entry landing on the one line the feed drew for it.
                    <ToolCallRow
                      key={step.key}
                      step={step}
                      selected={step.key === activeKey}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}
