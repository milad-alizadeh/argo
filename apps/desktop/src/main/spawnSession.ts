import { ipcMain } from 'electron'
import { type CommandResult, SESSION_SPAWN_CHANNEL } from '../shared'
import type { AgentLauncher } from './agentLauncher'
import type { Hub } from './hub'
import { projectFolder } from './projectFolder'

// ⌘N: start the project's agent CLI in the ACTIVE project's root folder. The cwd is the only
// thing spawn has to get right — Session→Project attribution is resolved from cwd (ADR-0015),
// and the incremental observer is what puts the Session in the roster once the CLI writes its
// first line. Claiming the folder is what makes that Session `managed` rather than `external`;
// when the PTY exits the claim is released and the Session demotes to `orphaned`, because
// ownership dies with the process and cannot be re-adopted (CONTEXT.md L2).
export function wireSpawn(hub: Hub, launcher: AgentLauncher): void {
  ipcMain.handle(SESSION_SPAWN_CHANNEL, (): CommandResult => {
    const state = hub.getState()
    const folder = projectFolder(state, state.activeProjectId)
    if (folder === null) return { ok: false, detail: 'no active project' }
    const launched = launcher.start(folder)
    return launched.ok ? { ok: true, detail: folder } : launched
  })
}
