import type { ProjectSetupActor } from './project-setup-actor'

export function setupScreenOf(actor: ProjectSetupActor) {
  switch (actor.getSnapshot().value) {
    case 'choosingMethod':
      return 'choosing-method' as const
    case 'manual':
    case 'deferred':
    case 'ready':
      return actor.getSnapshot().value
    case 'preflight':
      return 'preflight' as const
    case 'planningUnavailable':
      return 'planning-unavailable' as const
    case 'planning':
      return 'planning' as const
    case 'questions':
      return 'questions' as const
    case 'reviewingPlan':
      return 'reviewing-plan' as const
    case 'invalidPlan':
      return 'invalid-plan' as const
    case 'applying':
      return 'applying' as const
    case 'reviewingDiff':
      return 'reviewing-diff' as const
    case 'cancelling':
      return 'cancelling' as const
    case 'cancelFailed':
      return 'cancel-failed' as const
    case 'awaitingPlanningApproval':
    case 'awaitingApplicationApproval':
      return 'awaiting-approval' as const
    case 'finalizing':
      return 'finalizing' as const
    case 'reviewRequired':
      return 'review-required' as const
    case 'interrupted':
      return 'interrupted' as const
    default:
      throw new Error('ProjectSetup reached an unsupported state.')
  }
}
