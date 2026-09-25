// Keep main's current Project in sync with the renderer's persisted selection (#2269).
import { type ProjectError, projectError } from '@/domains/projects/contract/contract'
import type { ProjectListed, ProjectSelectRequest } from '@/domains/projects/contract/messages'
import { listed } from './presentation'
import { currentRegistry, type ProjectStore } from './register-project'

export function selectProject(
  request: ProjectSelectRequest,
  store: ProjectStore,
): Promise<ProjectListed | ProjectError> {
  return store.exclusive(async () => {
    const registry = await currentRegistry(store, request.requestId)
    if ('type' in registry) return registry
    if (!registry.projects.some((project) => project.id === request.projectId)) {
      return projectError('missing-project', request.requestId)
    }
    store.projects.selectProject(request.projectId)
    return listed(request.requestId, { ...registry, selectedId: request.projectId })
  })
}
