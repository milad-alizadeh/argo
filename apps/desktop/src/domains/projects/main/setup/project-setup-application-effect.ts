import type { AcceptedSetupPlan } from '@/domains/projects/contract/setup-plan'
import { projectSetupEffectEvents } from './project-setup-effect-events'
import type { ProjectSetupEffects } from './project-setup-effects'
import type { createProjectSetupRegistry } from './project-setup-registry'

export async function startApplicationEffect({
  acceptedPlan,
  effects,
  harness,
  projectId,
  registry,
  sessionId,
}: {
  acceptedPlan: AcceptedSetupPlan
  effects: ProjectSetupEffects
  harness: 'claude' | 'codex'
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
  sessionId?: string
}): Promise<void> {
  try {
    registry.transition(projectId, { type: 'EFFECT_INTENT_SAVED', effect: 'application' })
    const events = projectSetupEffectEvents({ effect: 'application', projectId, registry })
    const result = await effects.apply({
      acceptedPlan,
      harness,
      projectId,
      sessionId,
      ...events,
    })
    if ('kind' in result) {
      switch (result.kind) {
        case 'drifted':
          registry.transition(projectId, { type: 'APPLICATION_DRIFT', reason: result.reason })
          return
        case 'invalid':
          registry.transition(projectId, { type: 'INVALID_OUTPUT' })
          return
      }
    }
    registry.transition(projectId, {
      type: 'APPLICATION_COMPLETED',
      finalDiff: result.finalDiff,
      progress: [],
    })
  } catch {
    registry.transition(projectId, {
      type: 'EFFECT_INTERRUPTED',
      reason: 'Application Session ended before reporting a result.',
    })
  }
}
