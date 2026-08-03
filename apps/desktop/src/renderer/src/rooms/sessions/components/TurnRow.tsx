import { Text, useDisclosure } from '@/shared/components/ui'
import type { TimelineTurnModel } from '../interiorActivity'
import { CompactionMarker } from './CompactionMarker'
import { PlanProgress } from './PlanProgress'
import { ToolCallRow } from './ToolCallRow'

// The open turn leads with `running`; a closed one reports the reason the CLI gave, `unknown`
// included. A guessed reason would be a fabricated fact, so the word is never softened away.
const stopWord = (turn: TimelineTurnModel): string =>
  turn.open ? 'running' : (turn.stopReason ?? '')

/**
 * Molecule: one Turn in the timeline — its stop reason, its plan, and its tool calls as steps.
 *
 * The open turn is expanded and past turns fold, because what a session is doing now is what you
 * came to see. Folding is the row's own business, which is why it holds that state rather than
 * taking it.
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
      {turn.compactedBefore && <CompactionMarker />}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-snug px-gap text-left outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
      >
        <Text variant="row" className="min-w-0 flex-1 truncate text-foreground-soft">
          Turn
        </Text>
        <Text variant="eyebrow" className={turn.open ? 'text-tone-run' : 'text-foreground-faint'}>
          {stopWord(turn)}
        </Text>
      </button>
      {open && (
        <div className="flex flex-col gap-tight pl-gap">
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
    </li>
  )
}
