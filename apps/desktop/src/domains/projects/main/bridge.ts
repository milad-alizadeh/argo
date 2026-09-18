import { type BrowserWindow, dialog } from 'electron'
import { registerDomainHandlers } from '@/core/contract/domain'
import { platformText } from '@/core/i18n/platform'
import { createWriteQueue } from '@/core/storage/portable-file'
import { projectError } from '../contract/contract'
import { PROJECT_OPERATIONS } from '../contract/operations'
import { listProjects } from './list-projects'
import { openProject } from './open-project'
import { type ProjectStore, registerProject, relocateProject } from './register-project'
import { selectProject } from './select-project'
import type { ProjectStore as ProjectRegistryStore } from './sqlite-store'

// The folder chooser is the main process's authority and is never handed to the renderer, which
// asks for the action by name and receives the resulting registry (docs/portable-integration-contracts.md).
async function chooseFolder(window: BrowserWindow): Promise<string | null> {
  const chosen = await dialog.showOpenDialog(window, {
    title: platformText('dialog.openProject.title'),
    buttonLabel: platformText('dialog.openProject.confirm'),
    properties: ['openDirectory'],
  })
  if (chosen.canceled) return null
  return chosen.filePaths[0] ?? null
}

export function attachProjectBridge(
  window: BrowserWindow,
  storage: { projects: ProjectRegistryStore; rendererURL: string },
): void {
  const store: ProjectStore = {
    projects: storage.projects,
    chooseFolder: () => chooseFolder(window),
    exclusive: createWriteQueue(),
  }
  registerDomainHandlers({
    window,
    rendererURL: storage.rendererURL,
    operations: PROJECT_OPERATIONS,
    context: store,
    handlers: {
      open: (request, context) => openProject(request, context),
      list: (request, context) => listProjects(request, context),
      register: registerProject,
      relocate: relocateProject,
      select: selectProject,
    },
    error: projectError,
  })
}
