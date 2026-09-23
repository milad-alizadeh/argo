import { fromCallback } from 'xstate'
import type { ProjectSetupEvent } from '../project-setup-machine-types'
import { startProjectSetupTask } from '../project-setup-task'
import type { ProjectSetupServices } from './project-setup-actors'

export type ProjectSetupRestartInput = { sessionIds: string[] }

export function projectSetupRestartActor(
  services: Pick<ProjectSetupServices, 'archiveSession' | 'driver'>,
) {
  return fromCallback<ProjectSetupEvent, ProjectSetupRestartInput, ProjectSetupEvent>(
    ({ input, sendBack }) =>
      startProjectSetupTask(async () => {
        try {
          for (const sessionId of input.sessionIds) {
            if (services.driver.hasSession?.(sessionId) !== false) {
              await services.driver.interrupt(sessionId)
              await services.driver.waitForStop?.(sessionId)
            }
            const archived = await services.archiveSession(sessionId)
            if (!archived) {
              sendBack({ type: 'Restart attempt failed' })
              return
            }
          }
          sendBack({ type: 'Restart attempt completed' })
        } catch {
          sendBack({ type: 'Restart attempt failed' })
        }
      }),
  )
}
