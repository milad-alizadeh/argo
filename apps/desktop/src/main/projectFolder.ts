import type { CockpitState } from '../shared'

// Which folder an act runs in. A Project the hub does not know has no folder, and callers report
// that rather than falling back to a cwd the user never registered.
export function projectFolder(state: CockpitState, projectId: string | null): string | null {
  if (projectId === null) return null
  return state.projects.find((project) => project.id === projectId)?.path ?? null
}
