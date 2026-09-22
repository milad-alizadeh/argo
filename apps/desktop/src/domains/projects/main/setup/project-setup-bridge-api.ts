import type {
  ProjectSetupCommandRequest,
  ProjectSetupSnapshotRequest,
} from '@/domains/projects/contract/contract'
import { projectError } from '@/domains/projects/contract/contract'
import type { createProjectSetupRegistry } from '@/domains/projects/main/setup/persistence/project-setup-registry'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { commandHarnessIsAvailable, eventFor } from './project-setup-command'
import type { ProjectSetupRuntime } from './project-setup-logic'

type Registry = ReturnType<typeof createProjectSetupRegistry>
type Dependencies = {
  projects: ProjectStore
  registry: Registry
  runtime: ProjectSetupRuntime
}

export function projectSetupBridgeApi(
  projects: ProjectStore,
  registry: Registry,
  runtime: ProjectSetupRuntime,
) {
  const dependencies = { projects, registry, runtime }
  return {
    actorSnapshot: (projectId: string) => registry.snapshot(projectId),
    command: (request: ProjectSetupCommandRequest) => command({ ...dependencies, request }),
    snapshot: (request: ProjectSetupSnapshotRequest) => snapshot({ ...dependencies, request }),
  }
}

function command({
  projects,
  registry,
  request,
  runtime,
}: Dependencies & { request: ProjectSetupCommandRequest }) {
  if (!hasProject(projects, request.projectId))
    return projectError('missing-project', request.requestId)
  if (!commandHarnessIsAvailable(request.command, runtime))
    return response(request.requestId, registry.snapshot(request.projectId), runtime)
  const result = registry.commandWithStatus({
    commandId: request.commandId,
    event: eventFor(request.command),
    expectedRevision: request.expectedRevision,
    projectId: request.projectId,
  })
  return response(request.requestId, result.snapshot, runtime)
}

function snapshot({
  projects,
  registry,
  request,
  runtime,
}: Dependencies & { request: ProjectSetupSnapshotRequest }) {
  if (!hasProject(projects, request.projectId))
    return projectError('missing-project', request.requestId)
  return response(request.requestId, registry.snapshot(request.projectId), runtime)
}

function hasProject(projects: ProjectStore, projectId: string) {
  return projects.read().projects.some((project) => project.id === projectId)
}

function response(
  requestId: string,
  snapshot: ReturnType<Registry['snapshot']>,
  runtime: ProjectSetupRuntime,
) {
  return {
    ...snapshot,
    harnesses: runtime.harnesses,
    requestId,
    type: 'project.setup.snapshot' as const,
    version: 1 as const,
  }
}
