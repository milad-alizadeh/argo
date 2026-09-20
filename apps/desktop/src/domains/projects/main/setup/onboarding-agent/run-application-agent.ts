import { z } from 'zod'
import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import type { SetupApplicationProgressEvent } from '@/domains/projects/contract/setup-progress'
import { APPLY_MARKER, applicationAgentPrompt } from './prompts'
import { type OnboardingAgentDriver, runOnboardingAgent } from './run-onboarding-agent'
import { parseApplicationStepEvents } from './step-events'

const applicationReportSchema = z.object({
  outcome: z.enum(['completed', 'needs-review', 'failed']),
  steps: z.array(
    z.object({
      stepId: z.string().min(1),
      status: z.enum(['passed', 'failed']),
      message: z.string(),
    }),
  ),
  drift: z.string().optional(),
})
export type ApplicationReport = z.infer<typeof applicationReportSchema>

export type ApplicationRunOutcome =
  | { kind: 'report'; report: ApplicationReport }
  | { kind: 'invalid-output'; issues: string[] }
  | { kind: 'timed-out' }

export async function runApplicationAgent(
  driver: OnboardingAgentDriver,
  request: {
    projectRoot: string
    setupWorktreePath: string
    acceptedPlan: AcceptedSetupPlan
    onStepEvent?: (event: SetupApplicationProgressEvent) => void
    pollIntervalMs?: number
    timeoutMs?: number
  },
): Promise<ApplicationRunOutcome> {
  let announced = 0
  const outcome = await runOnboardingAgent(driver, {
    cwd: request.setupWorktreePath,
    prompt: applicationAgentPrompt({
      projectRoot: request.projectRoot,
      setupWorktreePath: request.setupWorktreePath,
      acceptedPlanJson: JSON.stringify(request.acceptedPlan),
    }),
    mode: 'acceptEdits',
    marker: APPLY_MARKER,
    pollIntervalMs: request.pollIntervalMs,
    timeoutMs: request.timeoutMs,
    onProgress: (text) => {
      const events = parseApplicationStepEvents(text, request.acceptedPlan.sourceRevision)
      for (const event of events.slice(announced)) request.onStepEvent?.(event)
      announced = events.length
    },
  })

  if (outcome.outcome === 'timed-out') return { kind: 'timed-out' }

  let payload: unknown
  try {
    payload = JSON.parse(outcome.payload)
  } catch (error) {
    return {
      kind: 'invalid-output',
      issues: [`Application output was not valid JSON: ${String(error)}`],
    }
  }
  const parsed = applicationReportSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      kind: 'invalid-output',
      issues: parsed.error.issues.map((issue: { message: string }) => issue.message),
    }
  }
  return { kind: 'report', report: parsed.data }
}
