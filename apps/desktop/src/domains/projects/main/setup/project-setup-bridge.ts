import type { BrowserWindow } from 'electron'
import type { ProjectStore } from '@/domains/projects/main/sqlite-store'
import { projectSetupBridgeApi } from './project-setup-bridge-api'
import { defaultHarnesses } from './project-setup-command'
import type { ProjectSetupEffects } from './project-setup-effects'
import { createProjectSetupRegistry } from './project-setup-registry'

const registries = new WeakMap<object, ReturnType<typeof createProjectSetupRegistry>>()
const changedChannel = 'argo:project:setup:changed'

export function createProjectSetupBridge(
  window: BrowserWindow,
  projects: ProjectStore,
  effects?: ProjectSetupEffects,
) {
  const registry = registryFor(projects)
  const unsubscribe = registry.subscribeAll((_projectId, snapshot) => {
    window.webContents.send(changedChannel, {
      version: 1,
      type: 'project.setup.snapshot',
      requestId: 'subscription',
      ...snapshot,
      harnesses: effects?.harnesses?.() ?? defaultHarnesses,
    })
  })
  window.once('closed', unsubscribe)
  return projectSetupBridgeApi(projects, registry, effects)
}

function registryFor(projects: ProjectStore) {
  const current = registries.get(projects)
  if (current) return current
  const registry = createProjectSetupRegistry(projects)
  registries.set(projects, registry)
  return registry
}
