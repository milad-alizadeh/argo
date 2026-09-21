import type { ProjectSetupCommandRequest } from '@/domains/projects/contract/contract'
import type { ProjectSetupEffects } from './project-setup-effects'
import { startPlanningEffect } from './project-setup-planning-effect'
import type { createProjectSetupRegistry } from './project-setup-registry'

export function continueProjectSetupPlanning({
  effects,
  projectId,
  registry,
  request,
  snapshot,
}: {
  effects: ProjectSetupEffects
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
  request: ProjectSetupCommandRequest
  snapshot: ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}): void {
  const attempt = snapshot.attempt
  if (!attempt?.planningSessionId) return
  const continuation = continuationFor(request)
  if (!continuation) return
  void startPlanningEffect({
    continuation: { ...continuation, sessionId: attempt.planningSessionId },
    effects,
    harness: attempt.planningHarness,
    projectId,
    registry,
  })
}

function continuationFor(request: ProjectSetupCommandRequest): { prompt: string } | null {
  switch (request.command.type) {
    case 'answer-questions':
      return {
        prompt: `The person answered the focused setup questions:\n${request.command.answers.map(({ answer, id }) => `- ${id}: ${answer}`).join('\n')}\nContinue the same planning pass and return the complete next result.`,
      }
    case 'request-plan-change':
      return {
        prompt: `Revise the plan in response to this review feedback:\n${request.command.feedback}\nKeep this Attempt and return the complete revised result.`,
      }
    case 'resume-planning':
      return {
        prompt: 'Reconcile the recorded Project source and continue this same planning Attempt.',
      }
    default:
      return null
  }
}
