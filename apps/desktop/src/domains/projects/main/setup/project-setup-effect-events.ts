import type { SetupStepStatus } from '@/domains/projects/contract/setup-progress'
import type { createProjectSetupRegistry } from './project-setup-registry'

export function projectSetupEffectEvents({
  effect,
  projectId,
  registry,
}: {
  effect: 'planning' | 'application'
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
}) {
  return {
    onPermission: ({ description, id }: { description: string; id: string }) =>
      registry.transition(projectId, {
        type: 'PERMISSION_REQUESTED',
        permissionId: id,
        description,
      }),
    onProgress: (progress: Array<{ stepId: string; status: SetupStepStatus; message: string }>) =>
      registry.transition(projectId, { type: 'PROGRESS_RECEIVED', progress }),
    onStarted: (sessionId: string) =>
      registry.transition(projectId, {
        type: effect === 'planning' ? 'PLANNING_SESSION_STARTED' : 'APPLICATION_SESSION_STARTED',
        sessionId,
      }),
  }
}
