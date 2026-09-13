import path from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import { isRecord, requestIdentifier } from '../../boundary'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import { projectError } from './contract'
import { listProjects } from './list-projects'
import { openProject } from './open-project'
import { type ProjectStore, registerProject, relocateProject } from './register-project'
import { PROJECT_OPERATIONS } from './operations'

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
const HANDLERS = {
  open: (request: unknown, store: ProjectStore) => openProject(request, store.registryPath),
  list: (request: unknown, store: ProjectStore) => listProjects(request, store.registryPath),
  register: registerProject,
  relocate: relocateProject,
} as const

function route(request: unknown, store: ProjectStore) {
  const action = isRecord(request) ? request.type : undefined
  const operation = (
    Object.keys(PROJECT_OPERATIONS) as Array<keyof typeof PROJECT_OPERATIONS>
  ).find((key) => PROJECT_OPERATIONS[key].name === action)
  if (operation === undefined) {
    // A `project.open` carrying an unsupported version still reaches its own handler, which is
    // where `unsupported-version` is decided.
    return projectError('invalid-request', requestIdentifier(request))
  }
  return HANDLERS[operation](request, store)
}

export function attachProjectBridge(
  window: BrowserWindow,
  storage: { userData: string; rendererURL: string },
): void {
  const store: ProjectStore = {
    registryPath: path.join(storage.userData, 'portable-v1', 'projects.json'),
    chooseFolder: () => chooseFolder(window),
  }
  window.webContents.ipc.handle(PROJECT_OPERATIONS.open.channel, (event, request: unknown) => {
    if (!isTrustedRendererFrame(event, window, storage.rendererURL)) {
      return projectError('access-denied', requestIdentifier(request))
    }
    return route(request, store)
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}
