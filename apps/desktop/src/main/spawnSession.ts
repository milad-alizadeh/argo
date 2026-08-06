import { ipcMain } from 'electron'
import { type CommandResult, SESSION_SPAWN_CHANNEL } from '../shared'
import type { AgentLauncher } from './agentLauncher'
import type { Hub } from './hub'
import { projectFolder } from './projectFolder'
import { provisionalSession } from './provisionalSession'

// ⌘N: start the project's agent CLI in the ACTIVE project's root folder. The cwd is the only
// thing spawn has to get right — Session→Project attribution is resolved from cwd (ADR-0015).
// Claiming the folder is what makes that Session `managed` rather than `external`; when the PTY
// exits the claim is released and the Session demotes to `orphaned`, because ownership dies with
// the process and cannot be re-adopted (CONTEXT.md L2).
//
// The roster row is published HERE, not by the observer that later reads the transcript: `claude`
// writes no record until its first prompt, and a row is the only place there is to type one (#361).
export function wireSpawn(hub: Hub, launcher: AgentLauncher, now: () => number = Date.now): void {
  ipcMain.handle(SESSION_SPAWN_CHANNEL, (): CommandResult => {
    const state = hub.getState()
    const folder = projectFolder(state, state.activeProjectId)
    if (folder === null) return { ok: false, detail: 'no active project' }
    const launched = launcher.start(folder)
    if (!launched.ok) return launched
    hub.apply({
      type: 'session-created',
      session: provisionalSession(launched.claim, folder, now()),
    })
    return { ok: true, detail: folder }
  })
}
