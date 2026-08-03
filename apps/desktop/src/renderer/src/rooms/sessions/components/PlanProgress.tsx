import type { PlanEntryStatus } from '@shared'
import { CaretRightIcon, CheckIcon, CircleIcon, Text } from '@/shared/components/ui'
import type { PlanProgressModel } from '../interiorActivity'

// A plan entry is a step of a plan, not a live process: it carries a MARK — done, here, not yet —
// rather than a status dot. A dot would put it in the same channel as a running tool call and make
// the eye read four live things where there is one.
const ENTRY_MARK: Record<PlanEntryStatus, { Glyph: typeof CheckIcon; tone: string }> = {
  completed: { Glyph: CheckIcon, tone: 'text-tone-done' },
  in_progress: { Glyph: CaretRightIcon, tone: 'text-tone-run' },
  pending: { Glyph: CircleIcon, tone: 'text-foreground-faint' },
}

const ENTRY_TEXT: Record<PlanEntryStatus, string> = {
  completed: 'text-foreground-faint',
  in_progress: 'text-foreground',
  pending: 'text-foreground-faint',
}

/**
 * Molecule: the agent's own live to-do list — `N/M` over one row per entry.
 *
 * The plan is the agent's, not Argo's: the entries are rendered as it wrote them, and the count is
 * arithmetic over their statuses rather than a separate claim.
 */
export function PlanProgress({ plan }: { plan: PlanProgressModel }): React.JSX.Element {
  return (
    <div data-component="PlanProgress" className="flex flex-col gap-hair">
      <Text variant="tag" className="px-gap text-foreground-faint">
        {`Plan · ${plan.done} of ${plan.total}`}
      </Text>
      <ul aria-label="Plan" className="flex flex-col gap-hair">
        {plan.entries.map((entry) => {
          const { Glyph, tone } = ENTRY_MARK[entry.status]
          return (
            <li key={entry.text} className="flex items-center gap-snug px-gap">
              <Glyph aria-hidden className={`icon-sm shrink-0 ${tone}`} />
              <Text variant="meta" className={`min-w-0 truncate ${ENTRY_TEXT[entry.status]}`}>
                {entry.text}
              </Text>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
