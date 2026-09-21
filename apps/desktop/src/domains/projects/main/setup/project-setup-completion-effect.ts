import type { ProjectSetupEffects } from './project-setup-effects'
import type { createProjectSetupRegistry } from './project-setup-registry'

export async function cancelActiveProjectSetupEffect({
  effects,
  projectId,
  registry,
  snapshot,
}: {
  effects: ProjectSetupEffects
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
  snapshot: ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}): Promise<void> {
  const effect = snapshot.activeEffect
  const sessionId =
    effect === 'planning'
      ? snapshot.attempt?.planningSessionId
      : snapshot.attempt?.applicationSessionId
  if (effect === null || sessionId === null || sessionId === undefined || !effects.cancel) return
  try {
    await effects.cancel({ effect, projectId, sessionId })
    registry.transition(projectId, { type: 'CANCEL_SETUP_CONFIRMED' })
  } catch {
    registry.transition(projectId, {
      type: 'CANCEL_SETUP_FAILED',
      reason: 'Argo could not confirm that the active Project setup Session stopped.',
    })
  }
}

export async function finalizeProjectSetupEffect({
  effects,
  projectId,
  registry,
}: {
  effects: ProjectSetupEffects
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
}): Promise<void> {
  try {
    if (!effects.complete) throw new Error('Project setup finalization is unavailable.')
    await effects.complete(projectId)
    registry.transition(projectId, { type: 'FINALIZATION_COMPLETED' })
  } catch {
    registry.transition(projectId, {
      type: 'FINALIZATION_FAILED',
      reason: 'Argo could not promote the approved Project setup worktree.',
    })
  }
}

export function decidePendingProjectSetupEffect({
  allow,
  effects,
  snapshot,
}: {
  allow: boolean
  effects: ProjectSetupEffects
  snapshot: ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}) {
  const pending = snapshot.pendingApproval
  const sessionId =
    pending?.effect === 'planning'
      ? snapshot.attempt?.planningSessionId
      : snapshot.attempt?.applicationSessionId
  if (!pending || !sessionId || !effects.decidePermission) return
  effects.decidePermission({ allow, sessionId, permissionId: pending.permissionId })
}
