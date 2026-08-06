import { spawn } from 'node-pty'
import type { Cli } from '../../shared'
import type { ClaimId, ManagedSessions } from '../observe'
import type { AgentTerminals } from './agentTerminals'

/** Started, or the reason it was not — node-pty throws synchronously when the CLI is not on main's
 * PATH, which is the common failure and the one worth saying out loud. */
export type Launched = { ok: true; claim: ClaimId } | { ok: false; detail: string }

/** Where the agent runs and which program it is. ⌘N stays zero-config by reading both off the
 * active Project (#186) rather than asking, so the caller passes one structure and the launcher
 * picks nothing. */
export interface Launch {
  cwd: string
  cli: Cli
}

export interface AgentLauncher {
  /**
   * Run the Project's agent CLI in its folder, claim that folder, and hand the pty to the
   * terminal registry.
   *
   * `onExit` fires when that pty is gone, carrying node-pty's own exit code, for the caller that
   * published something under the claim and now has to say so — ownership cannot come back
   * (CONTEXT.md L2).
   */
  start(launch: Launch, onExit?: (claim: ClaimId, exitCode: number) => void): Launched
}

export function createAgentLauncher(
  managed: ManagedSessions,
  terminals: AgentTerminals,
): AgentLauncher {
  return {
    start({ cwd, cli }, onExit) {
      try {
        const agent = spawn(cli, [], { name: 'xterm-color', cols: 80, rows: 24, cwd })
        const claim = managed.claim(cwd)
        // The pty is HANDED OVER rather than drained into nothing: the registry reads it forever
        // (a pty nobody reads back-pressures until the child stalls) and hands it to the Dock, which
        // is what makes the pane you type at the agent's own terminal (#323).
        terminals.adopt(claim, agent)
        agent.onExit(({ exitCode }) => {
          managed.release(claim)
          terminals.drop(claim)
          onExit?.(claim, exitCode)
        })
        return { ok: true, claim }
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
