import { ipcMain } from 'electron'
import { spawn } from 'node-pty'
import { type Cli, type CommandResult, SESSION_SPAWN_CHANNEL } from '../shared'
import type { Hub } from './hub'
import { observeAfterSpawn } from './observeAfterSpawn'
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
// and the observation sweep is what puts the Session in the roster.
export function wireSpawn(hub: Hub): void {
  ipcMain.handle(SESSION_SPAWN_CHANNEL, (): CommandResult => {
    const state = hub.getState()
    const folder = projectFolder(state, state.activeProjectId)
    if (folder === null) return { ok: false, detail: 'no active project' }

    const known = new Set(state.sessions.map((session) => session.id))
    const spawned = startAgent(folder)
    if (spawned.ok) void observeAfterSpawn(hub, known)
    return spawned
  })
}

function startAgent(cwd: string): CommandResult {
  try {
    const agent = spawn(SPAWN_CLI, [], { name: 'xterm-color', cols: 80, rows: 24, cwd })
    agent.onData(DRAIN)
    return { ok: true, detail: cwd }
  } catch (error) {
    // node-pty throws synchronously when the CLI is not on main's PATH, which is the common
    // failure and the one worth saying out loud rather than reporting a spawn that never happened.
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}
