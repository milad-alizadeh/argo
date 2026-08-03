import type { Room } from './shellModel'

// A project swap is a VIEW CHANGE, not a teardown: sessions keep running in main, and the
// UI state you left a project in is handed back on return. That is what this file holds —
// everything else about the swap survives because nothing about it was ever torn down.

/** What the shell remembers about one project while you are looking at another. */
export interface ProjectUi {
  room: Room
  selectedSessionId: string | null
}

/** Sessions is the launch default: a project you have never opened lands you in the
 * running world rather than in the backlog or the editor. */
export const DEFAULT_PROJECT_UI: ProjectUi = { room: 'sessions', selectedSessionId: null }

export type ProjectUiMemory = Record<string, ProjectUi>

export function rememberProjectUi(
  memory: ProjectUiMemory,
  projectId: string,
  ui: ProjectUi,
): ProjectUiMemory {
  return { ...memory, [projectId]: ui }
}

export function recallProjectUi(memory: ProjectUiMemory, projectId: string): ProjectUi {
  return memory[projectId] ?? DEFAULT_PROJECT_UI
}

/** Where `⌘[` / `⌘]` land, in the strip's own order. The walk wraps, because a strip of
 * projects is a ring you cycle rather than a list you fall off the end of. */
export function nextProjectId(ids: string[], activeId: string | null, step: -1 | 1): string | null {
  if (ids.length === 0) return null
  const current = activeId === null ? -1 : ids.indexOf(activeId)
  const from = current === -1 ? 0 : current
  return ids[(from + step + ids.length) % ids.length] ?? null
}
