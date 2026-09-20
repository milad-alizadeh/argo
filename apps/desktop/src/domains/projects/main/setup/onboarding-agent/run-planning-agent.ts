import {
  type SetupPlanningResult,
  setupPlanningResultSchema,
} from '@/domains/projects/contract/setup-plan'
import type { SetupPlanningProgressEvent } from '@/domains/projects/contract/setup-progress'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import { parseAgentOutput } from './parse-agent-output'
import { forwardProgress } from './progress-forwarder'
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
    model?: ClaudeTurnSetup['model']
    effort?: ClaudeTurnSetup['effort']
    pollIntervalMs?: number
    timeoutMs?: number
  },
): Promise<PlanningRunOutcome> {
  const outcome = await runOnboardingAgent(driver, {
    cwd: request.setupWorktreePath,
    prompt: planningAgentPrompt(request),
    mode: 'plan',
    marker: PLAN_MARKER,
    model: request.model,
    effort: request.effort,
    pollIntervalMs: request.pollIntervalMs,
    timeoutMs: request.timeoutMs,
    onProgress: forwardProgress(
      (text) => parsePlanningStepEvents(text, request.planRevision),
      request.onStepEvent,
    ),
  })

  if (outcome.outcome === 'timed-out') return { kind: 'timed-out' }

  const parsed = parseAgentOutput(outcome.payload, setupPlanningResultSchema, 'Planning')
  return parsed.kind === 'parsed' ? { kind: 'result', result: parsed.value } : parsed
}
