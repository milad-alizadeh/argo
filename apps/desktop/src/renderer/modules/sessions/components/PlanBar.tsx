import { useTranslation } from 'react-i18next'

import type { SessionPlan } from '../../../../core/sessions/models'

// The gap between two segments, and the narrowest a segment may be before it stops reading as one.
const GAP = 2
const WIDTH = 64
const NARROWEST = 2

// One segment per item on the agent's Plan (CONTEXT.md L3 · Plan), filled to what is done
// (`cockpit-roster-row.html` · PlanBar). The bar is one width whatever the count, so each segment
// takes its share of it. Exactly one item is in progress at a time, and it draws brightest while
// the Session is moving. A Session that is not moving is not progressing, so its fill is banked.
export function PlanBar({ plan, moving }: { plan: SessionPlan; moving: boolean }) {
  const { t } = useTranslation()
  const segment = Math.max(NARROWEST, (WIDTH - GAP * (plan.total - 1)) / plan.total)
  const doing = plan.completed + plan.inProgress
  const ink = (index: number) => {
    if (index < plan.completed) return moving ? 'bg-plan' : 'bg-plan-still'
    if (index < doing) return moving ? 'bg-plan-doing' : 'bg-plan-still'
    return 'bg-plan-track'
  }
  // A segment has no identity but its place, so its place is its key.
  const segments = Array.from({ length: plan.total }, (_, index) => ({
    key: `segment-${index}`,
    ink: ink(index),
  }))

  return (
    <span
      className="roster__plan inline-flex flex-none items-center gap-hair"
      role="img"
      aria-label={t('row.plan', { completed: plan.completed, total: plan.total })}
    >
      {segments.map((drawn) => (
        <i
          className={`h-(--size-plan-bar) rounded-full ${drawn.ink}`}
          key={drawn.key}
          style={{ width: segment }}
        />
      ))}
    </span>
  )
}
