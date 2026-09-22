import { fromCallback } from 'xstate'
import type {
  ProjectSetupContext,
  ProjectSetupEvent,
} from '@/domains/projects/main/setup/project-setup-machine-types'
import { startProjectSetupTask } from './project-setup-task'
import type { ProjectSetupServices } from './project-setup-logic'

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

export function projectSetupCancellationLogic(services: ProjectSetupServices) {
  return fromCallback<ProjectSetupEvent, ProjectSetupCancellationInput, ProjectSetupEvent>(
    ({ input, sendBack }) =>
      startProjectSetupTask(async () => {
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
