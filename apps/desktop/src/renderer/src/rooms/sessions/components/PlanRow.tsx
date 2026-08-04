import type { Plan, PlanEntry } from '@shared'
import { CheckSquareIcon, Text } from '@/shared/components/ui'
import { RowGlyph } from './RowGlyph'

// The plan where the agent REVISED it, as one line. The whole list with its marks is the left pane's
// tracker (`PlanProgress`), which is the session's current one and stays legible while every turn
// below it folds; this row says when the plan moved and what it moved onto. Drawing the entries twice
// would put the same four lines on screen twice over, and the second copy is not a second fact.

/** The step the row names: the one in progress, or the next one waiting where nothing is. `null` once
 * every entry is done — there is no next step, and naming a finished one would read as current. */
function currentStep(entries: readonly PlanEntry[]): string | null {
  const running = entries.find((entry) => entry.status === 'in_progress')
  const next = entries.find((entry) => entry.status === 'pending')
  return (running ?? next)?.text ?? null
}

/**
 * Molecule: the agent's to-do list at the point it was last revised — `plan 2 of 4 · Wire verify()`.
 *
 * ONE line, and one row per turn however many times that turn rewrote the list: a Turn carries the
 * snapshot in force while it ran (ADR-0020), so ten checkbox ticks update this row rather than
 * becoming ten of them.
 *
 * The count is arithmetic over the statuses rather than a separate claim, so it cannot disagree with
 * the tracker beside the feed.
 */
export function PlanRow({ plan }: { plan: Plan }): React.JSX.Element {
  const done = plan.entries.filter((entry) => entry.status === 'completed').length
  const step = currentStep(plan.entries)
  return (
    <div data-component="PlanRow" className="flex items-baseline gap-snug">
      <RowGlyph Icon={CheckSquareIcon} tone="text-foreground-faint" />
      <Text variant="code" className="shrink-0 text-foreground-faint">
        {`plan ${done} of ${plan.entries.length}`}
      </Text>
      {step !== null && (
        <Text variant="code" className="min-w-0 flex-1 truncate text-foreground-soft">
          {`· ${step}`}
        </Text>
      )}
    </div>
  )
}
