import { useCallback } from 'react'
import type { ShellCommand } from '@/shell/components'
import { useShellKeymap } from '@/useShellKeymap'
import type { ShellState } from '@/useShellState'

// Where the keymap and the chrome's clicks both land. Every command here is reachable BOTH ways —
// direct manipulation is the floor and the keymap is the spine over it — so this is the one place
// that says what an act actually does.

export interface ShellCommands {
  /** Main owns the folder picker, so the renderer names the act and never a path. */
  addProject: () => void
  /** ⌘N's other half: the roster's visible spawn affordance. Nothing here is keyboard-only. */
  spawnSession: () => void
  /** The diverged branch's first escape hatch. The terminal itself lives in the Code room. */
  openScratchTerminal: () => void
  /** The diverged branch's other hatch: an agent in the project root, which is what ⌘N spawns. */
  resolveWithAgent: () => void
}

export function useShellCommands(shell: ShellState): ShellCommands {
  // Spawn lands you where the session will appear: main starts the agent and the observation
  // re-sweep puts it in the roster, so the Sessions room is the only honest destination.
  const spawn = useCallback(() => {
    shell.selectRoom('sessions')
    void window.cockpit?.spawnSession()
  }, [shell])

  const run = useCallback(
    (command: ShellCommand) => {
      switch (command.kind) {
        case 'room':
          return shell.selectRoom(command.room)
        case 'project':
          return shell.stepProject(command.step)
        case 'spawn':
          return spawn()
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

  return {
    addProject: useCallback(() => void window.cockpit?.registerProject(), []),
    spawnSession: spawn,
    openScratchTerminal: useCallback(() => shell.selectRoom('code'), [shell]),
    resolveWithAgent: spawn,
  }
}
