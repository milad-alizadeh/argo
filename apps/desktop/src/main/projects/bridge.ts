import { dialog, ipcMain } from 'electron'
import {
  type CommandResult,
  normalizeProjectPath,
  PROJECT_ACTIVATE_CHANNEL,
  PROJECT_REGISTER_CHANNEL,
} from '../../shared'
import type { Hub } from '../hub'
import { registerProject, setActiveProject, toProjectView } from './registry'

// Registration and activation — the only two acts Argo owns above the Session (ADR-0017). Both
// persist to the registry BEFORE applying the hub event, so a relaunch opens into the world the
// window is already showing rather than the one before the click.
export function wireProjects(hub: Hub, registryFile: string): void {
  ipcMain.handle(PROJECT_REGISTER_CHANNEL, () => register(hub, registryFile))

  ipcMain.handle(PROJECT_ACTIVATE_CHANNEL, (_event, payload: unknown) => {
    if (typeof payload !== 'string') return { ok: false, detail: 'malformed project id' }
    return activate(hub, registryFile, payload)
  })
}

async function register(hub: Hub, registryFile: string): Promise<CommandResult> {
  const folder = await chooseFolder()
  if (folder === null) return { ok: false, detail: 'no folder chosen' }

  const root = normalizeProjectPath(folder)
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

// A folder is all a Project takes (CONTEXT.md L1), so the picker offers directories only and
// lets the user make one on the spot.
async function chooseFolder(): Promise<string | null> {
  const chosen = await dialog.showOpenDialog({
    title: 'Register a project folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  return chosen.canceled ? null : (chosen.filePaths[0] ?? null)
}
