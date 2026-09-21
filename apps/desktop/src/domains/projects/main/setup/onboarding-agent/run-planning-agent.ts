import {
  type SetupPlanningResult,
  setupPlanningResultSchema,
} from '@/domains/projects/contract/setup-plan'
import type { SetupPlanningProgressEvent } from '@/domains/projects/contract/setup-progress'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import { parseAgentOutput } from './parse-agent-output'
import { PLAN_MARKER, planningAgentPrompt } from './prompts'
import { runMarkedAgent } from './run-marked-agent'
import type { OnboardingAgentDriver } from './run-onboarding-agent'
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
  const outcome = await runMarkedAgent({
    driver,
    request: {
      cwd: request.setupWorktreePath,
      prompt: request.continuationPrompt ?? planningAgentPrompt(request),
      mode: 'plan',
      marker: PLAN_MARKER,
      model: request.model,
      effort: request.effort,
      pollIntervalMs: request.pollIntervalMs,
      timeoutMs: request.timeoutMs,
      onProgress: request.onStepEvent,
      parseProgress: (text) => parsePlanningStepEvents(text, request.planRevision),
      onStarted: request.onStarted,
      onPermission: request.onPermission,
      sessionId: request.sessionId,
    },
  })

  if (outcome.outcome === 'timed-out') return { kind: 'timed-out' }

  const parsed = parseAgentOutput(outcome.payload, setupPlanningResultSchema, 'Planning')
  return parsed.kind === 'parsed' ? { kind: 'result', result: parsed.value } : parsed
}
