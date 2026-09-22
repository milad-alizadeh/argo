import type { BrowserWindow } from 'electron'
import type { ProjectStore } from '../sqlite-store'
import type { ProjectSetupRuntime } from './actors/project-setup-actors'
import { createProjectSetupRegistry } from './persistence/project-setup-registry'
import { projectSetupBridgeApi } from './project-setup-bridge-api'

const registries = new WeakMap<object, ReturnType<typeof createProjectSetupRegistry>>()
const changedChannel = 'argo:project:setup:changed'

export function createProjectSetupBridge(
  window: BrowserWindow,
  projects: ProjectStore,
  runtime: ProjectSetupRuntime,
) {
  const registry = registryFor(projects, runtime)
  const unsubscribe = registry.subscribeAll((_projectId, snapshot) => {
    window.webContents.send(changedChannel, {
      version: 1,
      type: 'project.setup.snapshot',
      requestId: 'subscription',
      ...snapshot,
      harnesses: runtime.harnesses,
    })
  })
  window.once('closed', unsubscribe)
  return projectSetupBridgeApi(projects, registry, runtime)
}

function registryFor(projects: ProjectStore, runtime: ProjectSetupRuntime) {
  const current = registries.get(projects)
  if (current) return current
  const registry = createProjectSetupRegistry(projects, runtime)
  registries.set(projects, registry)
  return registry
}
