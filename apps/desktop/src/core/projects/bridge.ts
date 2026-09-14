import path from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import { registerDomainHandlers } from '../contract/domain'
import { createWriteQueue } from '../storage/portable-file'
import { projectError } from './contract'
import { listProjects } from './list-projects'
import { openProject } from './open-project'
import { PROJECT_OPERATIONS } from './operations'
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

export function attachProjectBridge(
  window: BrowserWindow,
  storage: { userData: string; rendererURL: string },
): void {
  const store: ProjectStore = {
    registryPath: path.join(storage.userData, 'portable-v1', 'projects.json'),
    chooseFolder: () => chooseFolder(window),
    exclusive: createWriteQueue(),
  }
  registerDomainHandlers({
    window,
    rendererURL: storage.rendererURL,
    operations: PROJECT_OPERATIONS,
    context: store,
    handlers: {
      open: (request, context) => openProject(request, context.registryPath),
      list: (request, context) => listProjects(request, context.registryPath),
      register: registerProject,
      relocate: relocateProject,
    },
    error: projectError,
  })
}
