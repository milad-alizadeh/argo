import { fromCallback } from 'xstate'
import type { ProjectSetupServices } from './actors/project-setup-actors'
import type { ProjectSetupContext, ProjectSetupEvent } from './project-setup-machine-types'
import { interruptAndWaitForProjectSetupSession } from './project-setup-session-lifecycle'
import { startProjectSetupTask } from './project-setup-task'

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
          await interruptAndWaitForProjectSetupSession(services.driver, input.sessionId)
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
