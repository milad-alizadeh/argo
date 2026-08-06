import { ipcMain } from 'electron'
import { type CommandResult, SESSION_SPAWN_CHANNEL } from '../../shared'
import type { Hub } from '../hub'
import { projectCli, projectFolder } from '../projects'
import type { AgentLauncher } from './agentLauncher'
import { endedSession, provisionalSession } from './provisionalSession'

// ⌘N: start the project's agent CLI in the ACTIVE project's root folder. The cwd is the only
// thing spawn has to get right — Session→Project attribution is resolved from cwd (ADR-0015).
// Claiming the folder is what makes that Session `managed` rather than `external`.
//
// The roster row is published HERE, not by the observer that later reads the transcript: `claude`
// writes no record until its first prompt, and a row is the only place there is to type one (#361).

interface Spawn {
  hub: Hub
  launcher: AgentLauncher
  now: () => number
}

export function wireSpawn(hub: Hub, launcher: AgentLauncher, now: () => number = Date.now): void {
  ipcMain.handle(
    SESSION_SPAWN_CHANNEL,
    (): CommandResult => spawnIntoRoster({ hub, launcher, now }),
  )
}

function spawnIntoRoster({ hub, launcher, now }: Spawn): CommandResult {
  const state = hub.getState()
  const folder = projectFolder(state, state.activeProjectId)
  const cli = projectCli(state, state.activeProjectId)
  if (folder === null || cli === null) return { ok: false, detail: 'no active project' }
  // An agent that exits before it has written anything leaves the one row no observation can
  // correct, so the same act that published it says when its pty is gone. Once the CLI HAS named a
  // Session the row is no longer there to end, and the observer grades that Session's own posture.
  const launched = launcher.start({ cwd: folder, cli }, (claim, exitCode) =>
    hub.apply({
      type: 'session-updated',
      session: endedSession({ claim, cwd: folder, cli, endedAtMs: now(), exitCode }),
    }),
  )
  if (!launched.ok) return launched
  hub.apply({
    type: 'session-created',
    session: provisionalSession({ claim: launched.claim, cwd: folder, cli, spawnedAtMs: now() }),
  })
  return { ok: true, detail: folder }
}
