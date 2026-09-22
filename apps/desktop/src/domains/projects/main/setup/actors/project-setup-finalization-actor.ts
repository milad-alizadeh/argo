import { fromCallback } from 'xstate'
import { promoteSetupWorktree } from '../project-setup-finalization'
import type { ProjectSetupEvent } from '../project-setup-machine-types'
import { startProjectSetupTask } from '../project-setup-task'
import type { ProjectSetupServices } from './project-setup-actors'

export function projectSetupFinalizationActor(services: ProjectSetupServices, projectId: string) {
  return fromCallback<ProjectSetupEvent, undefined, ProjectSetupEvent>(({ sendBack }) =>
    startProjectSetupTask(async () => {
      try {
        promoteSetupWorktree(services.projects, projectId)
        sendBack({ type: 'Finalization completed' })
      } catch {
        sendBack({
          type: 'Finalization failed',
          reason: 'finalization-failed',
        })
      }
    }),
  )
}
