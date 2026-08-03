import type { PlanEntryStatus } from '@shared'
import { StatusDot, Text } from '@/shared/components/ui'
import type { PlanProgressModel } from '../interiorActivity'
import type { ActivityDot } from '../interiorSubagents'

const ENTRY_DOT: Record<PlanEntryStatus, ActivityDot> = {
  completed: { tone: 'done', glow: 'quiet', pulse: false },
  in_progress: { tone: 'run', glow: 'live', pulse: true },
  pending: { tone: 'gray', glow: 'faint', pulse: false },
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
      <Text variant="tag" className="text-foreground-faint">
        {`Plan · ${plan.done} of ${plan.total}`}
      </Text>
      <ul aria-label="Plan" className="flex flex-col gap-hair">
        {plan.entries.map((entry) => {
          const dot = ENTRY_DOT[entry.status]
          return (
            <li key={entry.text} className="flex items-center gap-snug">
              <StatusDot tone={dot.tone} glow={dot.glow} pulse={dot.pulse} />
              <Text
                variant="meta"
                className={
                  entry.status === 'completed' ? 'text-foreground-faint' : 'text-foreground-soft'
                }
              >
                {entry.text}
              </Text>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
