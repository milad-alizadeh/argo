import type { ProjectSetupActor } from './project-setup-actor'

export function setupScreenOf(actor: ProjectSetupActor) {
  switch (actor.getSnapshot().value) {
    case 'Choosing setup method':
      return 'choosing-method' as const
    case 'Restarting attempt':
      return 'restarting' as const
    case 'Manual setup':
      return 'manual' as const
    case 'Deferred':
      return 'deferred' as const
    case 'Ready':
      return 'ready' as const
    case 'Planning':
      return actor.getSnapshot().context.pendingApproval ? 'awaiting-approval' : 'planning'
    case 'Questions':
      return 'questions' as const
    case 'Reviewing plan':
      return 'reviewing-plan' as const
    case 'Customizing Project setup':
      return 'customizing-project-setup' as const
    case 'Applying':
      return actor.getSnapshot().context.pendingApproval ? 'awaiting-approval' : 'applying'
    case 'Reviewing changes':
      return 'reviewing-diff' as const
    case 'Cancelling':
      return 'cancelling' as const
    case 'Cancel failed':
      return 'cancel-failed' as const
    case 'Finalizing':
      return 'finalizing' as const
    case 'Review required':
      return 'review-required' as const
    case 'Interrupted':
      return 'interrupted' as const
    default:
      throw new Error('ProjectSetup reached an unsupported state.')
  }
}
