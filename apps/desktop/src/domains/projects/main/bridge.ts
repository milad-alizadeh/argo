import { type BrowserWindow, dialog, net } from 'electron'
import { projectError } from '@/domains/projects/contract/contract'
import { PROJECT_OPERATIONS } from '@/domains/projects/contract/operations'
import { platformText } from '@/platform/main/i18n'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'
import { createWriteQueue } from '@/platform/main/storage/portable-file'
import { createManagedProjectWorkspace } from './create-managed-project-workspace'
import { listProjectWorkspaces } from './list-project-workspaces'
import { listProjects } from './list-projects'
import { openProject } from './open-project'
import { registerProject, relocateProject } from './register-project'
import { selectProject } from './select-project'
import { selectProjectWorkspace } from './select-project-workspace'
import { projectSetupRuntime } from './setup/actors/project-setup-actors'
import type { OnboardingAgentDriver } from './setup/onboarding-agent/runtime/run-onboarding-agent'
import {
  loadSetupDocument,
  type SetupDocumentSource,
  setupDocumentRequest,
  setupDocumentURL,
} from './setup/preparation/setup-bundle'
import { createProjectSetupBridge } from './setup/project-setup-bridge'
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
  storage: {
    projects: ProjectRegistryStore
    rendererURL: string
    setupDocumentSource?: SetupDocumentSource
    onboardingDriver: OnboardingAgentDriver
  },
): void {
  const setupDocument = () =>
    loadSetupDocument({
      documentURL: setupDocumentURL(storage.setupDocumentSource),
      request: setupDocumentRequest(storage.setupDocumentSource ?? 'production', (url) =>
        net.fetch(url, { method: 'GET' }),
      ),
    })
  const store = {
    projects: storage.projects,
    chooseFolder: () => chooseFolder(window),
    exclusive: createWriteQueue(),
    loadSetupDocument: setupDocument,
  }
  const projectSetup = createProjectSetupBridge(
    window,
    storage.projects,
    projectSetupRuntime({
      driver: storage.onboardingDriver,
      loadSetupDocument: setupDocument,
      projects: storage.projects,
    }),
  )
  registerDomainHandlers({
    window,
    rendererURL: storage.rendererURL,
    operations: PROJECT_OPERATIONS,
    context: {
      ...store,
      projectSetup: { snapshot: projectSetup.actorSnapshot },
      setupBridge: projectSetup,
    },
    handlers: {
      open: (request, context) => openProject(request, context),
      setupCommand: (request, context) => context.setupBridge.command(request),
      setupSnapshot: (request, context) => context.setupBridge.snapshot(request),
      list: (request, context) => listProjects(request, context),
      register: registerProject,
      relocate: relocateProject,
      select: selectProject,
      workspaceList: (request, context) =>
        context.exclusive(() => listProjectWorkspaces(request, context)),
      workspaceSelect: (request, context) =>
        context.exclusive(() => selectProjectWorkspace(request, context)),
      workspaceCreateManaged: (request, context) =>
        context.exclusive(() => createManagedProjectWorkspace(request, context)),
    },
    error: projectError,
  })
}
