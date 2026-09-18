import { z } from 'zod'

import type { PlanEntryStatus, SessionPlan } from '../../../core/sessions/models'
import type { WireMessage } from './protocol'

const planUpdateSchema = z.object({
  turnId: z.string(),
  plan: z.array(
    z.object({
      step: z.string().trim().min(1),
      status: z.enum(['pending', 'inProgress', 'completed']),
    }),
  ),
})

const PLAN_STATUS: Record<
  z.infer<typeof planUpdateSchema>['plan'][number]['status'],
  PlanEntryStatus
> = {
  pending: 'pending',
  inProgress: 'in_progress',
  completed: 'completed',
}

// `turn/plan/updated` maps Codex's `inProgress` wire spelling to the shared Session vocabulary (CONTEXT.md L3 · Plan).
export function readUpdatedPlan(message: WireMessage): SessionPlan | undefined {
  if (!('method' in message) || message.method !== 'turn/plan/updated') return undefined
  const update = planUpdateSchema.parse(message.params)
  return {
    state: 'available',
    entries: update.plan.map(({ status, step }, position) => ({
      content: step,
      position,
      status: PLAN_STATUS[status],
    })),
  }
}
