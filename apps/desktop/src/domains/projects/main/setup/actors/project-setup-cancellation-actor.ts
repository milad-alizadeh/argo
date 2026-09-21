import { fromCallback } from 'xstate'
import type {
  ProjectSetupContext,
  ProjectSetupEvent,
} from '@/domains/projects/main/setup/project-setup-machine-types'
import { startProjectSetupActorTask } from './project-setup-actor-task'
import type { ProjectSetupServices } from './project-setup-actors'

export type ProjectSetupCancellationInput = {
  effect: 'planning' | 'application' | null
  sessionId: string | null
}

export function projectSetupCancellationInput(
  context: ProjectSetupContext,
): ProjectSetupCancellationInput {
  return {
    effect: context.activeEffect,
    sessionId:
      context.activeEffect === 'planning'
        ? context.planningSessionId
        : context.applicationSessionId,
  }
}

export function projectSetupCancellationActor(services: ProjectSetupServices) {
  return fromCallback<ProjectSetupEvent, ProjectSetupCancellationInput, ProjectSetupEvent>(
    ({ input, sendBack }) =>
      startProjectSetupActorTask(async () => {
        if (!input.effect || !input.sessionId) return
        try {
          await services.driver.interrupt(input.sessionId)
          await services.driver.waitForStop?.(input.sessionId)
          sendBack({ type: 'Cancel setup confirmed' })
        } catch {
          sendBack({
            type: 'Cancel setup failed',
            reason: 'cancel-failed',
          })
        }
      }),
  )
}
