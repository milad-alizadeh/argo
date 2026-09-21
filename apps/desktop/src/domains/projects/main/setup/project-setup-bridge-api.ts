import type {
  ProjectSetupCommandRequest,
  ProjectSetupSnapshotRequest,
} from '@/domains/projects/contract/contract'
import { projectError } from '@/domains/projects/contract/contract'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { commandHarnessIsAvailable, defaultHarnesses, eventFor } from './project-setup-command'
import { startProjectSetupEffect } from './project-setup-effect-runner'
import type { ProjectSetupEffects } from './project-setup-effects'
import type { createProjectSetupRegistry } from './project-setup-registry'

type Registry = ReturnType<typeof createProjectSetupRegistry>
type Dependencies = {
  effects: ProjectSetupEffects | undefined
  projects: ProjectStore
  registry: Registry
}

export function projectSetupBridgeApi(
  projects: ProjectStore,
  registry: Registry,
  effects: ProjectSetupEffects | undefined,
) {
  const dependencies = { effects, projects, registry }
  return {
    actorSnapshot: (projectId: string) => registry.snapshot(projectId),
    command: (request: ProjectSetupCommandRequest) => command({ ...dependencies, request }),
    snapshot: (request: ProjectSetupSnapshotRequest) => snapshot({ ...dependencies, request }),
  }
}

function command({
  effects,
  projects,
  registry,
  request,
}: Dependencies & { request: ProjectSetupCommandRequest }) {
  if (!hasProject(projects, request.projectId))
    return projectError('missing-project', request.requestId)
  if (!commandHarnessIsAvailable(request.command, effects))
    return response(request.requestId, registry.snapshot(request.projectId), effects)
  const current = registry.snapshot(request.projectId)
  const result = registry.commandWithStatus({
    commandId: request.commandId,
    event: eventFor(request.command),
    expectedRevision: request.expectedRevision,
    projectId: request.projectId,
  })
  if (result.accepted) {
    startProjectSetupEffect({
      effects,
      projectId: request.projectId,
      registry,
      request,
      snapshot:
        request.command.type === 'approve-effect' || request.command.type === 'reject-effect'
          ? current
          : result.snapshot,
    })
  }
  return response(request.requestId, result.snapshot, effects)
}

function snapshot({
  effects,
  projects,
  registry,
  request,
}: Dependencies & { request: ProjectSetupSnapshotRequest }) {
  if (!hasProject(projects, request.projectId))
    return projectError('missing-project', request.requestId)
  return response(request.requestId, registry.snapshot(request.projectId), effects)
}

function hasProject(projects: ProjectStore, projectId: string) {
  return projects.read().projects.some((project) => project.id === projectId)
}

function response(
  requestId: string,
  snapshot: ReturnType<Registry['snapshot']>,
  effects: ProjectSetupEffects | undefined,
) {
  return {
    ...snapshot,
    harnesses: effects?.harnesses?.() ?? defaultHarnesses,
    requestId,
    type: 'project.setup.snapshot' as const,
    version: 1 as const,
  }
}
