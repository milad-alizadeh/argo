import type { ProjectSetupEffects } from './project-setup-effects'
import { startPlanningEffect } from './project-setup-planning-effect'
import type { createProjectSetupRegistry } from './project-setup-registry'

export async function startProjectSetupPreflight({
  effects,
  harness,
  projectId,
  registry,
}: {
  effects: ProjectSetupEffects
  harness: 'claude' | 'codex'
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
}): Promise<void> {
  try {
    if (!(await effects.preflight({ harness, projectId }))) {
      registry.transition(projectId, { type: 'PREFLIGHT_FAILED' })
      return
    }
    registry.transition(projectId, { type: 'PREFLIGHT_PASSED' })
    await startPlanningEffect({ effects, projectId, registry, harness })
  } catch {
    registry.transition(projectId, { type: 'PREFLIGHT_FAILED' })
  }
}
