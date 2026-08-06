import type { Cli, CockpitState } from '../../shared'

// Where and what an act runs. A Project the hub does not know has neither, and callers report
// that rather than falling back to a cwd or a program the user never registered.

export function projectFolder(state: CockpitState, projectId: string | null): string | null {
  if (projectId === null) return null
  return state.projects.find((project) => project.id === projectId)?.path ?? null
}

/** Which agent CLI ⌘N launches here (#186). `null` for a Project the hub does not know —
 * spawn has no folder to run in either, so it refuses rather than picking a default. */
export function projectCli(state: CockpitState, projectId: string | null): Cli | null {
  if (projectId === null) return null
  return state.projects.find((project) => project.id === projectId)?.cli ?? null
}
