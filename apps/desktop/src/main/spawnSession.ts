import { ipcMain } from 'electron'
import { spawn } from 'node-pty'
import { type Cli, type CommandResult, SESSION_SPAWN_CHANNEL } from '../shared'
import type { Hub } from './hub'
import type { ManagedSessions } from './observe'
import { projectFolder } from './projectFolder'

// ⌘N is zero-config (spec §"Canonical keymap"), so there is no CLI to pick and this is the one
// place the choice is made.
const SPAWN_CLI: Cli = 'claude'

// The PTY exists only to give the agent a terminal; nothing renders it, and a pty whose output
// is never read back-pressures until the child stalls. Draining it is what keeps the agent
// running (the Console's own steerable shell is a separate PTY — see terminalBridge).
const DRAIN = (): void => {}

// ⌘N: start the project's agent CLI in the ACTIVE project's root folder. The cwd is the only
// thing spawn has to get right — Session→Project attribution is resolved from cwd (ADR-0015),
// and the incremental observer is what puts the Session in the roster once the CLI writes its
// first line. Claiming the folder is what makes that Session `managed` rather than `external`;
// when the PTY exits the claim is released and the Session demotes to `orphaned`, because
// ownership dies with the process and cannot be re-adopted (CONTEXT.md L2).
export function wireSpawn(hub: Hub, managed: ManagedSessions): void {
  ipcMain.handle(SESSION_SPAWN_CHANNEL, (): CommandResult => {
    const state = hub.getState()
    const folder = projectFolder(state, state.activeProjectId)
    if (folder === null) return { ok: false, detail: 'no active project' }
    return startAgent(folder, managed)
  })
}

function startAgent(cwd: string, managed: ManagedSessions): CommandResult {
  try {
    const agent = spawn(SPAWN_CLI, [], { name: 'xterm-color', cols: 80, rows: 24, cwd })
    agent.onData(DRAIN)
    managed.claim(cwd)
    agent.onExit(() => managed.release(cwd))
    return { ok: true, detail: cwd }
  } catch (error) {
    // node-pty throws synchronously when the CLI is not on main's PATH, which is the common
    // failure and the one worth saying out loud rather than reporting a spawn that never happened.
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}
