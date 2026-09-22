import {
  type SetupPlanningResult,
  setupPlanningResultSchema,
} from '@/domains/projects/contract/setup'
import type { SetupPlanningProgressEvent } from '@/domains/projects/contract/setup'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import { parseAgentOutput } from '../protocol/parse-agent-output'
import { PLAN_MARKER, planningAgentPrompt } from '../protocol/prompts'
import { agentTurnObservers, parsePlanningStepEvents } from '../protocol/step-events'
import { type OnboardingAgentDriver, runOnboardingAgent } from '../runtime/run-onboarding-agent'

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
    continuationPrompt?: string
    priorPlanJson?: string
    onStepEvent?: (event: SetupPlanningProgressEvent) => void
    onStarted?: (sessionId: string) => void
    onPermission?: (permission: { id: string; description: string }) => void
    sessionId?: string
    model?: ClaudeTurnSetup['model']
    effort?: ClaudeTurnSetup['effort']
    pollIntervalMs?: number
    timeoutMs?: number
  },
): Promise<PlanningRunOutcome> {
  const outcome = await runOnboardingAgent(driver, {
    cwd: request.setupWorktreePath,
    prompt: request.continuationPrompt ?? planningAgentPrompt(request),
    mode: 'plan',
    marker: PLAN_MARKER,
    model: request.model,
    effort: request.effort,
    pollIntervalMs: request.pollIntervalMs,
    timeoutMs: request.timeoutMs,
    ...agentTurnObservers(request, (text) => parsePlanningStepEvents(text, request.planRevision)),
  })

  if (outcome.outcome === 'timed-out') return { kind: 'timed-out' }

  const parsed = parseAgentOutput(outcome.payload, setupPlanningResultSchema, 'Planning')
  return parsed.kind === 'parsed' ? { kind: 'result', result: parsed.value } : parsed
}
