import { fromCallback } from 'xstate'
import { promoteSetupWorktree } from '@/domains/projects/main/setup/project-setup-finalization'
import type { ProjectSetupEvent } from '@/domains/projects/main/setup/project-setup-machine-types'
import { startProjectSetupActorTask } from './project-setup-actor-task'
import type { ProjectSetupServices } from './project-setup-actors'

export function projectSetupFinalizationActor(services: ProjectSetupServices, projectId: string) {
  return fromCallback<ProjectSetupEvent, undefined, ProjectSetupEvent>(({ sendBack }) =>
    startProjectSetupActorTask(async () => {
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
