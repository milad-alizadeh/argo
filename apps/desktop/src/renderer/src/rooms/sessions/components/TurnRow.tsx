import { cn } from '@/lib/utils'
import {
  CaretDownIcon,
  CaretRightIcon,
  SectionHeader,
  Text,
  useDisclosure,
} from '@/shared/components/ui'
import { turnWord } from '../activityStates'
import type { TimelineTurnModel } from '../interiorActivity'
import { CompactionMarker } from './CompactionMarker'
import { NAV_ROW_SELECTED, TURN_CARD, TURN_CARD_PAST } from './rowRecipes'
import { ToolCallRow } from './ToolCallRow'

// What a folded turn says about itself instead of its steps: how much work is inside it. The record
// carries no turn start, so the summary counts what it observed and never reports a duration.
const foldedSummary = (turn: TimelineTurnModel): string =>
  `${turn.steps.length} ${turn.steps.length === 1 ? 'tool' : 'tools'}`

/**
 * Molecule: one Turn in the timeline — how long ago it ended, its stop reason, and its tool calls.
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
  /** Jump the detail feed to a step's events. */
  onSelect?: (key: string) => void
}): React.JSX.Element {
  const [open, toggle] = useDisclosure({ defaultOpen: turn.open })
  const Caret = open ? CaretDownIcon : CaretRightIcon
  // A folded turn whose step the feed is showing wears the selection itself: the scroll-spy can name
  // a step whose own row is not rendered, and a highlight on nothing visible tracks nothing.
  const holdsActive = !open && turn.steps.some((step) => step.key === activeKey)
  return (
    <li data-component="TurnRow" className="flex flex-col gap-tight">
      <div className={cn(open ? TURN_CARD : TURN_CARD_PAST, holdsActive && NAV_ROW_SELECTED)}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-snug px-inset py-gap text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          {/* The one gold thing inside the card. Inside a `Text` so the em-relative icon box tracks
              the row it opens rather than the 15px body — see PlanProgress for the same trick. */}
          <Text
            aria-hidden
            variant="row"
            className="grid w-mark-col shrink-0 place-items-center text-primary"
          >
            <Caret className="icon-sm" />
          </Text>
          {/* Numbered, because a stack of cards all reading `Turn` names its own type and nothing
              else — the ordinal is the only thing here that tells one exchange from another until the
              transcript parser carries the prompt that opened it (issue 324). */}
          <Text variant="row" className="shrink-0 text-foreground-soft">
            {`Turn ${turn.ordinal}`}
          </Text>
          {/* Beside the name rather than at the right edge, where the state and the weight already
              sit: an age is a property OF this turn, and the eye reading down the ordinals picks up
              old-versus-new without a column of its own. Absent on the open turn — it has not ended,
              and "now" is what running already says. */}
          {turn.age !== null && (
            <Text variant="meta" className="min-w-0 flex-1 truncate text-foreground-faint">
              {turn.age}
            </Text>
          )}
          {turn.age === null && <span className="flex-1" />}
          {/* A past card reports its WEIGHT and nothing else. The stop reason of finished work is the
              least interesting fact about it, and spending the row's right edge on `END_TURN` says
              nothing a reader came for — the open turn's live state is the one worth the width. */}
          {open ? (
            <Text
              variant="eyebrow"
              className={`shrink-0 ${turn.open ? 'text-tone-run' : 'text-foreground-faint'}`}
            >
              {turnWord(turn.stopReason)}
            </Text>
          ) : (
            <Text variant="tag" className="shrink-0 text-foreground-faint">
              {foldedSummary(turn)}
            </Text>
          )}
        </button>
        {open && (
          <div className="flex flex-col gap-region px-inset pb-inset">
            {turn.steps.length > 0 && (
              <div className="flex flex-col gap-tight">
                <SectionHeader
                  label="Did"
                  count={`${turn.steps.length} ${turn.steps.length === 1 ? 'call' : 'calls'}`}
                />
                <ul aria-label="Tool calls" className="-mx-tight flex flex-col">
                  {turn.steps.map((step) => (
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
      {/* The mark sits BEFORE this turn in time, and the list runs newest first — so it renders
          UNDER the turn it precedes. Above it would claim the history was condensed after the work
          it actually came before. */}
      {turn.compactedBefore && <CompactionMarker />}
    </li>
  )
}
