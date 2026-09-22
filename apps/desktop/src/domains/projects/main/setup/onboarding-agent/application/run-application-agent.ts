import { z } from 'zod'
import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup/setup-plan'
import type { SetupApplicationProgressEvent } from '@/domains/projects/contract/setup/setup-progress'
import { parseAgentOutput } from '../protocol/parse-agent-output'
import { APPLY_MARKER, applicationAgentPrompt } from '../protocol/prompts'
import { agentTurnObservers, parseApplicationStepEvents } from '../protocol/step-events'
import { type OnboardingAgentDriver, runOnboardingAgent } from '../runtime/run-onboarding-agent'

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
    feedback?: string
    onStepEvent?: (event: SetupApplicationProgressEvent) => void
    onStarted?: (sessionId: string) => void
    onPermission?: (permission: { id: string; description: string }) => void
    sessionId?: string
    pollIntervalMs?: number
    timeoutMs?: number
  },
): Promise<ApplicationRunOutcome> {
  const outcome = await runOnboardingAgent(driver, {
    cwd: request.setupWorktreePath,
    prompt: applicationAgentPrompt({
      projectRoot: request.projectRoot,
      setupWorktreePath: request.setupWorktreePath,
      acceptedPlanJson: JSON.stringify(request.acceptedPlan),
      feedback: request.feedback,
    }),
    mode: 'acceptEdits',
    marker: APPLY_MARKER,
    pollIntervalMs: request.pollIntervalMs,
    timeoutMs: request.timeoutMs,
    ...agentTurnObservers(request, (text) =>
      parseApplicationStepEvents(text, request.acceptedPlan.sourceRevision),
    ),
  })

  if (outcome.outcome === 'timed-out') return { kind: 'timed-out' }

  const parsed = parseAgentOutput(outcome.payload, applicationReportSchema, 'Application')
  return parsed.kind === 'parsed' ? { kind: 'report', report: parsed.value } : parsed
}
