// Picking a Project from the dropdown writes the choice to the registry, the same file
// `registerProject` and `relocateProject` commit to, so a fresh main process reads the same
// selection a dev-server restart wiped from the renderer's Query cache (#2269).
import { type ProjectError, projectError } from './contract'
import type { ProjectListed, ProjectSelectRequest } from './messages'
import { commit, currentRegistry, type ProjectStore } from './register-project'

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
    return commit(store, request.requestId, { ...registry, selectedId: request.projectId })
  })
}
