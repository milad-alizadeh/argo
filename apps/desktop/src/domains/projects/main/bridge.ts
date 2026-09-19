import { type BrowserWindow, dialog } from 'electron'
import { projectError } from '@/domains/projects/contract/contract'
import { PROJECT_OPERATIONS } from '@/domains/projects/contract/operations'
import { listProjects } from '@/domains/projects/main/list-projects'
import { openProject } from '@/domains/projects/main/open-project'
import { registerProject, relocateProject } from '@/domains/projects/main/register-project'
import { selectProject } from '@/domains/projects/main/select-project'
import {
  beginManualSetup,
  cancelManualSetup,
  saveManualSetup,
  validateManualSetup,
} from '@/domains/projects/main/setup/manual-setup'
import {
  loadSetupDocument,
  type SetupDocumentSource,
  setupDocumentURL,
} from '@/domains/projects/main/setup/setup-bundle'
import type { ProjectStore as ProjectRegistryStore } from '@/domains/projects/main/sqlite-store'
import { platformText } from '@/platform/main/i18n'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'
import { createWriteQueue } from '@/platform/main/storage/portable-file'
import { send } from '@/providers/request'

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
  storage: {
    projects: ProjectRegistryStore
    rendererURL: string
    setupDocumentSource?: SetupDocumentSource
  },
): void {
  const setupDocument = () =>
    loadSetupDocument({
      documentURL: setupDocumentURL(storage.setupDocumentSource),
      request: (url) => send(url, { method: 'GET' }),
    })
  const store = {
    projects: storage.projects,
    chooseFolder: () => chooseFolder(window),
    exclusive: createWriteQueue(),
    loadSetupDocument: setupDocument,
  }
  registerDomainHandlers({
    window,
    rendererURL: storage.rendererURL,
    operations: PROJECT_OPERATIONS,
    context: store,
    handlers: {
      open: (request, context) => openProject(request, context),
      setupBegin: (request, context) => beginManualSetup(request, context),
      setupSave: (request, context) => saveManualSetup(request, context),
      setupValidate: (request, context) => validateManualSetup(request, context),
      setupCancel: (request, context) => cancelManualSetup(request, context),
      list: (request, context) => listProjects(request, context),
      register: registerProject,
      relocate: relocateProject,
      select: selectProject,
    },
    error: projectError,
  })
}
