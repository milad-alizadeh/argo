// Picking a Project from the dropdown writes the choice to the registry, the same file
// `registerProject` and `relocateProject` commit to, so a fresh main process reads the same
// selection a dev-server restart wiped from the renderer's Query cache (#2269).
import { projectError } from './contract'
import type { ProjectListed, ProjectSelectRequest } from './messages'
import { openRegistry, type ProjectStore } from './register-project'
import { listed, readRegistry, writeRegistry } from './registry'

export function selectProject(
  request: ProjectSelectRequest,
  store: ProjectStore,
): Promise<ProjectListed | ReturnType<typeof projectError>> {
  return store.exclusive(async () => {
    const registry = openRegistry(await readRegistry(store.registryPath))
    if (typeof registry === 'string') return projectError(registry, request.requestId)
    if (!registry.projects.some((project) => project.id === request.projectId)) {
      return projectError('missing-project', request.requestId)
    }
    const selected = { ...registry, selectedId: request.projectId }
    if (!(await writeRegistry(store.registryPath, selected))) {
      return projectError('storage-not-written', request.requestId)
    }
    return listed(request.requestId, selected)
  })
}
