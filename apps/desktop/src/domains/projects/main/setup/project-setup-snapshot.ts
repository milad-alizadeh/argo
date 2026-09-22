import type { ProjectSetupSnapshot as ContractProjectSetupSnapshot } from '@/domains/projects/contract/contract'
import type { ProjectSetupActor } from './project-setup-actor'
import { setupScreenOf } from './project-setup-screen-of'

export type ProjectSetupSnapshot = Omit<
  ContractProjectSetupSnapshot,
  'requestId' | 'type' | 'version'
>

export function projectSetupSnapshot({
  actor,
  projectId,
  revision,
}: {
  actor: ProjectSetupActor
  projectId: string
  revision: number
}): ProjectSetupSnapshot {
  const context = actor.getSnapshot().context
  return {
    projectId,
    revision,
    screen: setupScreenOf(actor) as ProjectSetupSnapshot['screen'],
    manualSource: context.manualSource,
    attempt:
      context.attemptNumber === null || context.selectedHarness === null
        ? null
        : {
            number: context.attemptNumber,
            planningHarness: context.selectedHarness,
            applicationHarness: context.applicationHarness,
            planningSessionId: context.planningSessionId,
            applicationSessionId: context.applicationSessionId,
          },
    questions: context.questions,
    plan: context.plan,
    acceptedPlan: context.acceptedPlan,
    progress: context.progress,
    finalDiff: context.finalDiff,
    activeEffect: context.activeEffect,
    recoveryMessage: context.recoveryMessage,
    pendingApproval: context.pendingApproval,
  }
}
