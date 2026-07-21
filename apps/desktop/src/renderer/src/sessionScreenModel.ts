import type { LifecycleNodeKey } from '@shared'
import type { RosterActor } from '@/domains/activity/components'
import type { ConsoleCapture } from '@/domains/console/components'
import type {
  AllFilesDiffFile,
  ChangesView,
  DeliveryCommitGroup,
  DeliveryProps,
  DeliveryTab,
  NodeDrawerSession,
} from '@/domains/delivery/components'
import type { SessionView } from '@/sessionStore'
import { deliveryState } from '@/shared/delivery'
import type { WorkspaceTree } from './WorkspaceIdentity'

// The SessionScreen's view-model: the pure derivation between the projection (sessions + facts)
// and the assembled spine. Container (App.tsx) owns the UI state and the honest-empty rich data;
// this file turns one Session + that state into the props each region reads. React-free and
// unit-testable — the ONE truly-derived field is the delivery `lifecycle` (`deliveryState`);
// everything else is passed through honestly, empty until Seam B enriches the projection.

/** Whether the work row is split (Activity ‖ Delivery) or solo (Activity alone, Delivery out). */
export type SpineVariant = 'split' | 'solo'
/** The three resizable edges of the spine — one custom property each. */
export type SpineEdge = 'roster' | 'activity' | 'console'

/** Everything `Delivery` reads, minus the callbacks and chrome the View wires itself. */
export type DeliveryData = Omit<
  DeliveryProps,
  'onSelectTab' | 'onChangeChangesView' | 'onAdvanceFindingState' | 'className'
>

/** The three fields `Console` reads off the model; the callbacks and height are the View's. */
export interface ConsoleData {
  capture?: ConsoleCapture
  activeChannel: string
  expanded: boolean
}

/** Where a Session is working — the shape `WorkspaceIdentity` renders. */
export interface WorkspaceModel {
  branch: string
  tree: WorkspaceTree
  directory: string
  dirty: number
  ahead: number
  behind: number
  sharedCount: number
}

/** The "doing now" strip — an already-composed icon and line the caller hands `NowLine`. */
export interface NowLineModel {
  icon: React.ReactNode
  line: React.ReactNode
  live: boolean
}

export interface SessionHeaderModel {
  project: string
  title: string
  workspace: WorkspaceModel | null
  variant: SpineVariant
}

export interface ActivityModel {
  nowLine: NowLineModel | null
  actors: readonly RosterActor[]
}

export interface SessionPanelModel {
  variant: SpineVariant
  header: SessionHeaderModel
  activity: ActivityModel
  delivery: DeliveryData
  console: ConsoleData
}

/** The rich per-Session data the projection has NOT enriched yet (Seam B) — honest-empty in
 * the app, fixtures in the stories. Only the delivery `lifecycle` and the roster word are
 * genuinely derived this ticket; the rest arrives empty rather than fabricated. */
export interface RichSessionData {
  workspace: WorkspaceModel | null
  nowLine: NowLineModel | null
  actors: readonly RosterActor[]
  pr: { num: number; ghUrl: string } | null
  drawerSession: NodeDrawerSession
  reviewOutstanding: number
  artifactsCount: number
  allFiles: AllFilesDiffFile[]
  commitGroups: DeliveryCommitGroup[]
}

/** The screen-level UI state the container holds: the variant, which node's drawer is open,
 * the selected tab and Changes view, and the console's channel. The console's expanded flag is
 * NOT stored here — it's derived from the console's height (the single source of truth). */
export interface PanelUiState {
  variant: SpineVariant
  openNode: LifecycleNodeKey | null
  tab: DeliveryTab
  changesView: ChangesView
  activeChannel: string
}

/** An empty NodeDrawer session — every slice present and inert, so a drawer renders its
 * honest empty body rather than crashing on a missing field (R7/openNode null this ticket). */
export const EMPTY_DRAWER_SESSION: NodeDrawerSession = {
  commits: { dirty: 0, headSha: null, unpushed: 0, draftMessage: '' },
  pr: { headSha: '' },
  ci: { sha: '', status: 'passed', aggregate: '', runs: [] },
  review: { rounds: [] },
  merge: { prNum: 0, headSha: '' },
  merged: { sha: '', how: '', by: '', when: '' },
  closed: { by: '', when: '', note: '' },
}

/** The honest-empty rich data the app passes until Seam B enriches the projection. */
export const emptyRichSession = (): RichSessionData => ({
  workspace: null,
  nowLine: null,
  actors: [],
  pr: null,
  drawerSession: EMPTY_DRAWER_SESSION,
  reviewOutstanding: 0,
  artifactsCount: 0,
  allFiles: [],
  commitGroups: [],
})

/** Turn one Session plus the screen's UI state into the panel model each region reads. The
 * only derivation is the delivery `lifecycle` (via `deliveryState`, the same one the roster
 * grades from) — everything else is threaded straight through from `ui` and `rich`. */
export function buildSessionPanel({
  session,
  ui,
  consoleExpanded,
  rich = emptyRichSession(),
}: {
  session: SessionView
  ui: PanelUiState
  /** Derived from the console's height by the container — never a stored flag. */
  consoleExpanded: boolean
  rich?: RichSessionData
}): SessionPanelModel {
  const { lifecycle } = deliveryState(session.facts)
  return {
    variant: ui.variant,
    header: {
      project: 'argo',
      title: session.title,
      workspace: rich.workspace,
      variant: ui.variant,
    },
    activity: { nowLine: rich.nowLine, actors: rich.actors },
    delivery: {
      lifecycle,
      openNode: ui.openNode,
      pr: rich.pr,
      drawerSession: rich.drawerSession,
      tab: ui.tab,
      changesView: ui.changesView,
      reviewOutstanding: rich.reviewOutstanding,
      artifactsCount: rich.artifactsCount,
      allFiles: rich.allFiles,
      commitGroups: rich.commitGroups,
    },
    console: { capture: undefined, activeChannel: ui.activeChannel, expanded: consoleExpanded },
  }
}
