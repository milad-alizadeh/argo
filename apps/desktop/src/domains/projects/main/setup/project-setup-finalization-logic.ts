import { fromCallback } from 'xstate'
import { promoteSetupWorktree } from '@/domains/projects/main/setup/project-setup-finalization'
import type { ProjectSetupEvent } from '@/domains/projects/main/setup/project-setup-machine-types'
import { startProjectSetupTask } from './project-setup-task'
import type { ProjectSetupServices } from './project-setup-logic'

export function projectSetupFinalizationLogic(services: ProjectSetupServices, projectId: string) {
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
