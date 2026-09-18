import { randomUUID } from 'node:crypto'
import type { DevelopmentInstance } from '@/platform/main/development/instance'
import { repositoryRoot } from './repository'
import type { ProjectRegistration, ProjectStore } from './sqlite-store'

type Repository = Pick<ProjectRegistration, 'path' | 'commonDirectory'>

// A development window opens the repository in its worktree, not an empty cockpit. The common
// git directory keeps that one Project stable as a developer moves between ticket worktrees.
export function selectDevelopmentProject(projects: ProjectStore, repository: Repository): void {
  const registry = projects.read()
  const existing = registry.projects.find(
    (project) => project.commonDirectory === repository.commonDirectory,
  )
  if (existing) {
    if (existing.path !== repository.path) projects.updateProjectPath(existing.id, repository.path)
    if (registry.selectedId !== existing.id) projects.selectProject(existing.id)
    return
  }
  const project = { id: `project-${randomUUID()}`, ...repository }
  projects.insertProject(project)
  projects.selectProject(project.id)
}

export async function seedDevelopmentProject(
  projects: ProjectStore,
  instance: DevelopmentInstance,
): Promise<void> {
  const repository = await repositoryRoot(instance.worktree)
  if ('failure' in repository) return
  selectDevelopmentProject(projects, {
    path: repository.root,
    commonDirectory: repository.commonDirectory,
  })
}
