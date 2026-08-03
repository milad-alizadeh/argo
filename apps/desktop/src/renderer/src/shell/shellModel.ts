import type { CockpitState } from '@shared'
import { type RosterTone, worstStateDot } from '@/shared/delivery'

// What the chrome renders, derived from the projected state. The strip's whole job is the
// projects you are NOT looking at, which is why the active tab is deliberately quiet: its
// sessions are one glance away in the roster, so a badge on it would be a second telling.

export const ROOMS = ['sessions', 'work', 'code'] as const

/** Which room the stage is showing. Sessions is the launch default: you land in the
 * running world, and Work and Code are entered deliberately. */
export type Room = (typeof ROOMS)[number]

export interface ProjectTabView {
  id: string
  name: string
  /** The tab's visible glyph — the strip is 60px wide and holds no room for a name. */
  initial: string
  active: boolean
  /** The one worst-state dot, or null when this project's sessions want nothing. */
  dot: RosterTone | null
  /** How long ago THIS project last synced, for the active tab's tooltip. `null` while the
   * fact is unobserved — the tooltip shows the name alone rather than inventing an age. */
  lastSynced: string | null
}

export interface ShellModel {
  tabs: ProjectTabView[]
  /** False when no project is registered: the strip shows only `+` and the stage hosts
   * the connect seam rather than faking a room. */
  connected: boolean
}

export function buildShellModel(state: CockpitState): ShellModel {
  const tabs = state.projects.map((project) => {
    const active = project.id === state.activeProjectId
    return {
      id: project.id,
      name: project.name,
      initial: project.name.slice(0, 1).toUpperCase(),
      active,
      dot: active ? null : worstStateDot(state.sessions, project.id),
      lastSynced: null,
    }
  })
  return { tabs, connected: tabs.length > 0 }
}
