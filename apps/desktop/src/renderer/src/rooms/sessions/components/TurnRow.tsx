import { Text, useDisclosure } from '@/shared/components/ui'
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
  return (
    <li data-component="TurnRow" className="flex flex-col gap-tight">
      <div className={open ? TURN_CARD : TURN_CARD_PAST}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center gap-snug px-inset py-gap text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          {/* A glyph in the accent ink, not an icon: the fold is the one gold thing inside the card,
              and an icon box at control size out-weighs the 11px line it opens. */}
          <Text
            aria-hidden
            variant="code-inline"
            className="w-mark-col shrink-0 text-center text-primary"
          >
            {open ? '▾' : '▸'}
          </Text>
          <Text variant="row" className="min-w-0 flex-1 truncate text-foreground-soft">
            Turn
          </Text>
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
          // `gap-region`, not `gap-tight`: the plan and the calls are two CHANNELS — what the agent
          // said it would do, and what it has actually done — and at a tight gap they read as one
          // flat list of eight rows. Each channel is named, because a card holding two of them has
          // to say which is which.
          <div className="flex flex-col gap-region px-inset pb-inset">
            {turn.plan && <PlanProgress plan={turn.plan} />}
            {turn.steps.length > 0 && (
              <div className="flex flex-col gap-tight">
                <Text variant="tag" className="text-foreground-faint">
                  {`Did · ${turn.steps.length} ${turn.steps.length === 1 ? 'call' : 'calls'}`}
                </Text>
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
