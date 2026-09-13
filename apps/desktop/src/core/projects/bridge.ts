import path from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import { isRecord, requestIdentifier } from '../../boundary'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import { PROJECT_CHANNEL, projectError } from './contract'
import { listProjects } from './list-projects'
import { openProject } from './open-project'
import { type ProjectStore, registerProject, relocateProject } from './register-project'

// The folder chooser is the main process's authority and is never handed to the renderer, which
// asks for the action by name and receives the resulting registry (docs/portable-integration-contracts.md).
async function chooseFolder(window: BrowserWindow): Promise<string | null> {
  const chosen = await dialog.showOpenDialog(window, {
    title: 'Open Project',
    buttonLabel: 'Open',
    properties: ['openDirectory'],
  })
  if (chosen.canceled) return null
  return chosen.filePaths[0] ?? null
}

// A lookup keyed by the action, so an unknown one falls off the end as `invalid-request` rather
// than reaching a handler.
const ACTIONS = {
  'project.open': (request: unknown, store: ProjectStore) =>
    openProject(request, store.registryPath),
  'project.list': (request: unknown, store: ProjectStore) =>
    listProjects(request, store.registryPath),
  'project.register': registerProject,
  'project.relocate': relocateProject,
} as const

function route(request: unknown, store: ProjectStore) {
  const action = isRecord(request) ? request.type : undefined
  if (typeof action !== 'string' || !Object.hasOwn(ACTIONS, action)) {
    // A `project.open` carrying an unsupported version still reaches its own handler, which is
    // where `unsupported-version` is decided.
    return projectError('invalid-request', requestIdentifier(request))
  }
  return ACTIONS[action as keyof typeof ACTIONS](request, store)
}

export function attachProjectBridge(
  window: BrowserWindow,
  storage: { userData: string; rendererURL: string },
): void {
  const store: ProjectStore = {
    registryPath: path.join(storage.userData, 'portable-v1', 'projects.json'),
    chooseFolder: () => chooseFolder(window),
  }
  window.webContents.ipc.handle(PROJECT_CHANNEL, (event, request: unknown) => {
    if (!isTrustedRendererFrame(event, window, storage.rendererURL)) {
      return projectError('access-denied', requestIdentifier(request))
    }
    return route(request, store)
  })
}
