import path from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import { isRecord, requestIdentifier } from '../../boundary'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import { PROJECT_CHANNEL, projectError } from './contract'
import { importProjects, type ProjectImportStore } from './import-projects'
import { listProjects } from './list-projects'
import { PROJECT_IMPORT_ACTION } from './messages'
import { openProject } from './open-project'
import { type ProjectStore, registerProject, relocateProject } from './register-project'

type BridgeStore = ProjectStore & ProjectImportStore

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
const ACTIONS: Record<string, (request: unknown, store: BridgeStore) => unknown> = {
  'project.open': (request, store) => openProject(request, store.registryPath),
  'project.list': (request, store) => listProjects(request, store.registryPath),
  'project.register': registerProject,
  'project.relocate': relocateProject,
  [PROJECT_IMPORT_ACTION]: importProjects,
}

function route(request: unknown, store: BridgeStore) {
  const action = isRecord(request) ? request.type : undefined
  const handler = typeof action === 'string' ? ACTIONS[action] : undefined
  if (!handler) {
    // A `project.open` carrying an unsupported version still reaches its own handler, which is
    // where `unsupported-version` is decided.
    return projectError('invalid-request', requestIdentifier(request))
  }
  return handler(request, store)
}

export function attachProjectBridge(
  window: BrowserWindow,
  storage: { userData: string; rendererURL: string },
): void {
  const store: BridgeStore = {
    registryPath: path.join(storage.userData, 'portable-v1', 'projects.json'),
    sourceRegistryPath: path.join(storage.userData, 'projects.json'),
    chooseFolder: () => chooseFolder(window),
  }
  window.webContents.ipc.handle(PROJECT_CHANNEL, (event, request: unknown) => {
    if (!isTrustedRendererFrame(event, window, storage.rendererURL)) {
      return projectError('access-denied', requestIdentifier(request))
    }
    return route(request, store)
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}
