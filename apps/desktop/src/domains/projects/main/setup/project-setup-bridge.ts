import type { BrowserWindow } from 'electron'
import type {
  ProjectSetupCommandRequest,
  ProjectSetupSnapshotRequest,
} from '@/domains/projects/contract/contract'
import { projectError } from '@/domains/projects/contract/contract'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { createProjectSetupRegistry } from './project-setup-registry'

const registries = new WeakMap<object, ReturnType<typeof createProjectSetupRegistry>>()
const changedChannel = 'argo:project:setup:changed'

export function createProjectSetupBridge(window: BrowserWindow, projects: ProjectStore) {
  const registry = registryFor(projects)
  const unsubscribe = registry.subscribeAll((_projectId, snapshot) => {
    window.webContents.send(changedChannel, {
      version: 1,
      type: 'project.setup.snapshot',
      requestId: 'subscription',
      ...snapshot,
    })
  })
  window.once('closed', unsubscribe)
  return {
    actorSnapshot: (projectId: string) => registry.snapshot(projectId),
    command: (request: ProjectSetupCommandRequest) =>
      registered({
        projects,
        projectId: request.projectId,
        requestId: request.requestId,
        read: () =>
          registry.command({
            projectId: request.projectId,
            commandId: request.commandId,
            expectedRevision: request.expectedRevision,
            event: eventFor(request.command),
          }),
      }),
    snapshot: (request: ProjectSetupSnapshotRequest) =>
      registered({
        projects,
        projectId: request.projectId,
        requestId: request.requestId,
        read: () => registry.snapshot(request.projectId),
      }),
  }
}

function registryFor(projects: ProjectStore) {
  const current = registries.get(projects)
  if (current) return current
  const registry = createProjectSetupRegistry(projects)
  registries.set(projects, registry)
  return registry
}

function registered({
  projects,
  projectId,
  requestId,
  read,
}: {
  projects: ProjectStore
  projectId: string
  requestId: string
  read: () => ReturnType<ReturnType<typeof createProjectSetupRegistry>['snapshot']>
}) {
  if (!projects.read().projects.some((project) => project.id === projectId))
    return projectError('missing-project', requestId)
  return { version: 1 as const, type: 'project.setup.snapshot' as const, requestId, ...read() }
}

function eventFor(command: ProjectSetupCommandRequest['command']) {
  switch (command.type) {
    case 'choose-manual':
      return { type: 'CHOOSE_MANUAL' } as const
    case 'defer':
      return { type: 'DEFER' } as const
    case 'back':
      return { type: 'BACK' } as const
    case 'save-manual':
      return { type: 'SAVE_MANUAL', source: command.source } as const
    case 'resume-setup':
      return { type: 'RESUME_SETUP' } as const
    case 'start-repair-or-upgrade':
      return { type: 'START_REPAIR_OR_UPGRADE' } as const
  }
}
