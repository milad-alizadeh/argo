import type { ProjectStore } from '@/domains/projects/main/sqlite-store'

export function promoteSetupWorktree(projects: ProjectStore, projectId: string): void {
  const project = projects.read().projects.find((candidate) => candidate.id === projectId)
  if (!project) return
  const checkpoint = projects.readSetupCheckpoint(projectId)
  if (!checkpoint) throw new Error('The approved Project setup has no prepared worktree.')
  projects.promoteSetupWorktree(projectId, checkpoint.worktreePath)
}
