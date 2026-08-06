import { spawn } from 'node-pty'
import type { Cli } from '../shared'
import type { AgentTerminals } from './agentTerminals'
import type { ClaimId, ManagedSessions } from './observe'

/** ⌘N is zero-config (spec §"Canonical keymap"), so there is no CLI to pick and this is the one
 * place the choice is made — the roster's own row for a spawn reads it from here rather than
 * naming a second `claude`. */
export const SPAWN_CLI: Cli = 'claude'

/** Started, or the reason it was not — node-pty throws synchronously when the CLI is not on main's
 * PATH, which is the common failure and the one worth saying out loud. */
export type Launched = { ok: true; claim: ClaimId } | { ok: false; detail: string }

export interface AgentLauncher {
  /** Run the agent CLI in `cwd`, claim the folder, and hand the pty to the terminal registry. */
  start(cwd: string): Launched
}

export function createAgentLauncher(
  managed: ManagedSessions,
  terminals: AgentTerminals,
): AgentLauncher {
  return {
    start(cwd) {
      try {
        const agent = spawn(SPAWN_CLI, [], { name: 'xterm-color', cols: 80, rows: 24, cwd })
        const claim = managed.claim(cwd)
        // The pty is HANDED OVER rather than drained into nothing: the registry reads it forever
        // (a pty nobody reads back-pressures until the child stalls) and hands it to the Dock, which
        // is what makes the pane you type at the agent's own terminal (#323).
        terminals.adopt(claim, agent)
        agent.onExit(() => {
          managed.release(claim)
          terminals.drop(claim)
        })
        return { ok: true, claim }
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
