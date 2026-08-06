import { dialog, ipcMain } from 'electron'
import {
  type Cli,
  type CommandResult,
  isCli,
  normalizeProjectPath,
  PROJECT_ACTIVATE_CHANNEL,
  PROJECT_CHOOSE_FOLDER_CHANNEL,
  PROJECT_CREATE_CHANNEL,
  PROJECT_SET_CLI_CHANNEL,
} from '../../shared'
import type { Hub } from '../hub'
import { registerProject, setActiveProject, setProjectCli, toProjectView } from './registry'

// The acts Argo owns above the Session (ADR-0017), fronted for the connect panel. Each persists
// to the registry BEFORE applying the hub event, so a relaunch opens into the world the window
// is already showing rather than the one before the click.
//
// Choosing a folder and creating the Project are two acts because the panel puts a decision
// between them (#165): a folder is all a Project takes, so `Create project` lights up the
// moment one is chosen and connections may follow in any order.
export function wireProjects(hub: Hub, registryFile: string): void {
  ipcMain.handle(PROJECT_CHOOSE_FOLDER_CHANNEL, chooseFolder)

  ipcMain.handle(PROJECT_CREATE_CHANNEL, (_event, payload: unknown) => {
    if (typeof payload !== 'string' || payload.trim() === '') {
      return { ok: false, detail: 'no folder chosen' }
    }
    return create(hub, registryFile, payload)
  })

  ipcMain.handle(PROJECT_ACTIVATE_CHANNEL, (_event, payload: unknown) => {
    if (typeof payload !== 'string') return { ok: false, detail: 'malformed project id' }
    return activate(hub, registryFile, payload)
  })

  ipcMain.handle(PROJECT_SET_CLI_CHANNEL, (_event, projectId: unknown, cli: unknown) => {
    if (typeof projectId !== 'string' || !isCli(cli)) {
      return { ok: false, detail: 'malformed agent choice' }
    }
    return chooseCli(hub, registryFile, { projectId, cli })
  })
}

async function create(hub: Hub, registryFile: string, path: string): Promise<CommandResult> {
  const root = normalizeProjectPath(path)
  const registry = await registerProject(registryFile, root)
  const record = registry.projects.find((project) => project.path === root)
  if (record === undefined) return { ok: false, detail: 'the folder could not be registered' }

  hub.apply({ type: 'project-registered', project: toProjectView(record) })
  return { ok: true, detail: root }
}

async function activate(hub: Hub, registryFile: string, projectId: string): Promise<CommandResult> {
  const registry = await setActiveProject(registryFile, projectId)
  if (registry.activeProjectId !== projectId) return { ok: false, detail: 'unknown project' }

  hub.apply({ type: 'project-activated', id: projectId })
  return { ok: true, detail: projectId }
}

async function chooseCli(
  hub: Hub,
  registryFile: string,
  choice: { projectId: string; cli: Cli },
): Promise<CommandResult> {
  const registry = await setProjectCli(registryFile, choice.projectId, choice.cli)
  const record = registry.projects.find((project) => project.id === choice.projectId)
  if (record?.cli !== choice.cli) return { ok: false, detail: 'unknown project' }

  hub.apply({ type: 'project-cli-changed', id: choice.projectId, cli: choice.cli })
  return { ok: true, detail: choice.cli }
}

// A folder is all a Project takes (CONTEXT.md L1) and git is not required, so the picker offers
// directories only and lets the user make one on the spot. It REPORTS the folder rather than
// registering it: what to do with it is the panel's decision, not the picker's.
async function chooseFolder(): Promise<CommandResult> {
  const chosen = await dialog.showOpenDialog({
    title: 'Choose a project folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  const folder = chosen.canceled ? null : (chosen.filePaths[0] ?? null)
  if (folder === null) return { ok: false, detail: 'no folder chosen' }
  return { ok: true, detail: normalizeProjectPath(folder) }
}
