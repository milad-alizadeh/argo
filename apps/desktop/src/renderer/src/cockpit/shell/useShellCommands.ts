import { useCallback, useState } from 'react'
import type { ShellCommand } from '@/shell/components'
import { useShellKeymap } from './useShellKeymap'
import type { ShellState } from './useShellState'

// Where the keymap and the chrome's clicks both land. Every command here is reachable BOTH ways —
// direct manipulation is the floor and the keymap is the spine over it — so this is the one place
// that says what an act actually does.

export interface ShellCommands {
  /** ⌘N's other half: the roster's visible spawn affordance. Nothing here is keyboard-only. */
  spawnSession: () => void
  /** The diverged branch's first escape hatch. The terminal itself lives in the Code room. */
  openScratchTerminal: () => void
  /** The diverged branch's other hatch: an agent in the project root, which is what ⌘N spawns. */
  resolveWithAgent: () => void
  /** Why the last spawn did not happen, in the tool's own words; `null` when none refused. */
  spawnRefusal: string | null
}

export function useShellCommands(shell: ShellState): ShellCommands {
  const [spawnRefusal, setSpawnRefusal] = useState<string | null>(null)

  // Spawn lands you where the session will appear: main starts the agent and puts its row in the
  // roster at once, so the Sessions room is the only honest destination. A refusal — no active
  // project, or `claude` missing from a packaged app's minimal PATH — is otherwise indistinguishable
  // from a spawn that worked, since both do nothing visible to the shell (#361).
  const spawn = useCallback(async () => {
    shell.selectRoom('sessions')
    const result = await window.cockpit?.spawnSession()
    setSpawnRefusal(result === undefined || result.ok ? null : result.detail)
  }, [shell])

  const run = useCallback(
    (command: ShellCommand) => {
      switch (command.kind) {
        case 'room':
          return shell.selectRoom(command.room)
        case 'project':
          return shell.stepProject(command.step)
        case 'spawn':
          return void spawn()
        case 'dismiss':
          return shell.selectSession(null)
        case 'palette':
          // The palette is its own ticket. Claiming the chord and opening nothing is the honest
          // half: the shell has no surface to show, and it advertises none in the bar either.
          return
        default: {
          const unreachable: never = command
          return unreachable
        }
      }
    },
    [shell, spawn],
  )

  useShellKeymap(run)

  const startSession = useCallback(() => void spawn(), [spawn])

  return {
    spawnSession: startSession,
    openScratchTerminal: useCallback(() => shell.selectRoom('code'), [shell]),
    resolveWithAgent: startSession,
    spawnRefusal,
  }
}
