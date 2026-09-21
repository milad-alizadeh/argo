import { projectSetupEffectEvents } from './project-setup-effect-events'
import type { ProjectSetupEffects } from './project-setup-effects'
import type { createProjectSetupRegistry } from './project-setup-registry'

export async function startPlanningEffect({
  continuation,
  effects,
  harness,
  projectId,
  registry,
}: {
  continuation?: { prompt: string; sessionId: string }
  effects: ProjectSetupEffects
  harness: 'claude' | 'codex'
  projectId: string
  registry: ReturnType<typeof createProjectSetupRegistry>
}): Promise<void> {
  try {
    registry.transition(projectId, { type: 'EFFECT_INTENT_SAVED', effect: 'planning' })
    const events = projectSetupEffectEvents({ effect: 'planning', projectId, registry })
    const result = await effects.plan({
      continuation,
      harness,
      projectId,
      ...events,
    })
    switch (result.kind) {
      case 'questions':
        registry.transition(projectId, { type: 'QUESTIONS_RECEIVED', questions: result.questions })
        return
      case 'plan':
        registry.transition(projectId, { type: 'PLAN_VALIDATED', plan: result.plan })
        return
      case 'invalid':
        registry.transition(projectId, { type: 'INVALID_OUTPUT' })
    }
  } catch {
    registry.transition(projectId, {
      type: 'EFFECT_INTERRUPTED',
      reason: 'Planning Session ended.',
    })
  }
}
