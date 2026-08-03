import { CaretDownIcon, CaretRightIcon, Text, useDisclosure } from '@/shared/components/ui'
import { turnWord } from '../activityWords'
import type { TimelineTurnModel } from '../interiorActivity'
import { CompactionMarker } from './CompactionMarker'
import { PlanProgress } from './PlanProgress'
import { TURN_CARD, TURN_CARD_PAST } from './rowRecipes'
import { ToolCallRow } from './ToolCallRow'

// What a folded turn says about itself instead of its steps: how much work is inside it. The record
// carries no turn start, so the summary counts what it observed and never reports a duration.
const foldedSummary = (turn: TimelineTurnModel): string =>
  `${turn.steps.length} ${turn.steps.length === 1 ? 'tool' : 'tools'}`

/**
 * Molecule: one Turn in the timeline — its stop reason, its plan, and its tool calls as steps.
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
  return (
    <li data-component="TurnRow" className="flex flex-col gap-tight">
      <div className={open ? TURN_CARD : TURN_CARD_PAST}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-snug px-inset py-gap text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          <Caret aria-hidden className="icon-sm shrink-0 text-foreground-faint" />
          <Text variant="row" className="min-w-0 flex-1 truncate text-foreground-soft">
            Turn
          </Text>
          {!open && (
            <Text variant="tag" className="shrink-0 text-foreground-faint">
              {foldedSummary(turn)}
            </Text>
          )}
          <Text variant="eyebrow" className={turn.open ? 'text-tone-run' : 'text-foreground-faint'}>
            {turnWord(turn.stopReason)}
          </Text>
        </button>
        {open && (
          <div className="flex flex-col gap-tight px-gap pb-gap">
            {turn.plan && <PlanProgress plan={turn.plan} />}
            <ul aria-label="Tool calls" className="flex flex-col">
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
      {/* The mark sits BEFORE this turn in time, and the list runs newest first — so it renders
          UNDER the turn it precedes. Above it would claim the history was condensed after the work
          it actually came before. */}
      {turn.compactedBefore && <CompactionMarker />}
    </li>
  )
}
