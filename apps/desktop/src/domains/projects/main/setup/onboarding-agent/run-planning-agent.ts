import { setupPlanningResultSchema, type SetupPlanningResult } from '@/domains/projects/contract/setup-plan'
import type { SetupPlanningProgressEvent } from '@/domains/projects/contract/setup-progress'
import { PLAN_MARKER, planningAgentPrompt } from './prompts'
import type { OnboardingAgentDriver } from './run-onboarding-agent'
import { runOnboardingAgent } from './run-onboarding-agent'
import { parsePlanningStepEvents } from './step-events'

export type PlanningRunOutcome =
  | { kind: 'result'; result: SetupPlanningResult }
  | { kind: 'invalid-output'; issues: string[] }
  | { kind: 'timed-out' }

export async function runPlanningAgent(
  driver: OnboardingAgentDriver,
  request: {
    projectRoot: string
    setupWorktreePath: string
    skillPrompt: string
    skillRevision: string
    planRevision: string
    priorPlanJson?: string
    onStepEvent?: (event: SetupPlanningProgressEvent) => void
    pollIntervalMs?: number
    timeoutMs?: number
  },
): Promise<PlanningRunOutcome> {
  let announced = 0
  const outcome = await runOnboardingAgent(driver, {
    cwd: request.setupWorktreePath,
    prompt: planningAgentPrompt(request),
    mode: 'plan',
    marker: PLAN_MARKER,
    pollIntervalMs: request.pollIntervalMs,
    timeoutMs: request.timeoutMs,
    onProgress: (text) => {
      const events = parsePlanningStepEvents(text, request.planRevision)
      for (const event of events.slice(announced)) request.onStepEvent?.(event)
      announced = events.length
    },
  })

  if (outcome.outcome === 'timed-out') return { kind: 'timed-out' }

  let payload: unknown
  try {
    payload = JSON.parse(outcome.payload)
  } catch (error) {
    return { kind: 'invalid-output', issues: [`Planning output was not valid JSON: ${String(error)}`] }
  }
  const parsed = setupPlanningResultSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      kind: 'invalid-output',
      issues: parsed.error.issues.map((issue: { message: string }) => issue.message),
    }
  }
  return { kind: 'result', result: parsed.data }
}
