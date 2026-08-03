import type { SessionView } from '@shared'
import { type ActivityModel, buildActivity } from './interiorActivity'
import { buildDock, type DockModel } from './interiorDock'
import {
  buildInteriorHeader,
  noSessionLink,
  type SessionHeaderModel,
  type SessionLink,
} from './interiorHeader'

// The session interior's one derivation: header, the selected tab's surface, and the Dock. The
// screen composes Views over it and derives nothing itself, which is what lets the interior's
// contract be asserted in a unit test instead of through the DOM.

/** Exactly two tabs (`cockpit-spec.md` §4.2). Outcomes was cut, Preview was never a tab. */
export const INTERIOR_TABS = ['activity', 'delivery'] as const

export type InteriorTab = (typeof INTERIOR_TABS)[number]

/** The interior's own UI state, held by the room: which tab is showing and how tall the Dock is.
 * Which session is open is the shell's business, not the room's. */
export interface InteriorUiState {
  tab: InteriorTab
  /** Which item of the Activity surface the user last clicked. Scroll-spy owns the highlight after
   * that, so this is the jump target rather than a stored selection. */
  jumpKey: string | null
}

export const DEFAULT_INTERIOR_UI: InteriorUiState = { tab: 'activity', jumpKey: null }

export interface SessionInteriorModel {
  header: SessionHeaderModel
  tab: InteriorTab
  activity: ActivityModel
  dock: DockModel
  /** A freshly spawned session has done nothing yet: no turns, no subagents. The Dock is then
   * home, and the Activity surface carries the invitation rather than an empty two-pane. */
  fresh: boolean
}

/** Turn one Session plus the room's UI state into everything the interior renders. */
export function buildSessionInterior({
  session,
  ui = DEFAULT_INTERIOR_UI,
  link = noSessionLink(),
  nowMs = null,
}: {
  session: SessionView
  ui?: InteriorUiState
  link?: SessionLink
  /** Wall clock, injected so the derivation stays pure. */
  nowMs?: number | null
}): SessionInteriorModel {
  const activity = buildActivity(session)
  return {
    header: buildInteriorHeader({ session, link, nowMs }),
    tab: ui.tab,
    activity,
    dock: buildDock(session),
    fresh: activity.turns.length === 0 && activity.subagents === null,
  }
}
