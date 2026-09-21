import type { SetupPlan } from '@/domains/projects/contract/setup-plan'
import type { runPlanningAgent } from '@/domains/projects/main/setup/onboarding-agent/run-planning-agent'

export function planningResult(result: Awaited<ReturnType<typeof runPlanningAgent>>) {
  switch (result.kind) {
    case 'result':
      switch (result.result.status) {
        case 'needs-user-input':
          return { kind: 'questions', questions: result.result.questions } as const
        case 'ready-for-review':
          return { kind: 'plan', plan: result.result.plan } as const
        case 'cannot-plan':
          return { kind: 'invalid' } as const
      }
      return { kind: 'invalid' } as const
    case 'invalid-output':
    case 'timed-out':
      return { kind: 'invalid' } as const
  }
}

export type PlanningEffectResult =
  | { kind: 'questions'; questions: Array<{ id: string; prompt: string }> }
  | { kind: 'plan'; plan: SetupPlan }
  | { kind: 'invalid' }
