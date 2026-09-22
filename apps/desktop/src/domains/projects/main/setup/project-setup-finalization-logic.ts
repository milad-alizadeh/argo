import { fromCallback } from 'xstate'
import type { ProjectStore } from '../sqlite-store'
import type { ProjectSetupServices } from './project-setup-logic'
import type { ProjectSetupEvent } from './project-setup-machine-types'
import { startProjectSetupTask } from './project-setup-task'

function promoteSetupWorktree(projects: ProjectStore, projectId: string): void {
  const project = projects.read().projects.find((candidate) => candidate.id === projectId)
  if (!project) return
  const checkpoint = projects.readSetupCheckpoint(projectId)
  if (!checkpoint) throw new Error('The approved Project setup has no prepared worktree.')
  projects.promoteSetupWorktree(projectId, checkpoint.worktreePath)
}

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
