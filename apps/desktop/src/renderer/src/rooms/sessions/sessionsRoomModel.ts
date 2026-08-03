import type { LifecycleModel, SessionView } from '@shared'
import { deliveryState, isHotHeadState } from '@/shared/status'

// The Sessions room's rail derivation: the active project's observed sessions turned into the rows
// the rail draws, in render order, with the finished ones already gone to Archived. Pure and
// React-free — `cockpit-ui-inventory.md` puts the rail's order and word here rather than in a
// component, so the contract is asserted as arithmetic instead of through the DOM.

/** The rail's status pair, read off `deliveryState` rather than re-declared: the row must not grow
 * a second status vocabulary beside the one every room reads. */
type Graded = { session: SessionView } & ReturnType<typeof deliveryState>

/** A fact Argo could not establish reads `unknown` — never a default, never invented
 * (`cockpit-failure-states-spec.md` §8). */
const UNKNOWN = 'unknown'

export interface RosterRow {
  id: string
  /** The session's title. The stable fallback chain (explicit name → linked ticket →
   * conversation-derived) is resolved upstream by the observer, so the rail never re-derives it. */
  name: string
  word: Graded['rail']['word']
  /** State is carried ENTIRELY by the dot: its tone, its hollow ring and its glow. */
  dot: Graded['rail']['dot']
  /** The model id verbatim as the transcript reported it, or `unknown`. */
  model: string
  /** The row's second segment: the branch for a session Argo drives, the working PATH for one it
   * only observes. */
  place: string
  /** Argo only observes this session, so the row is ghosted and earns no state word. */
  external: boolean
  selected: boolean
  /** Spend the screen's ONE animation budget on this row's dot. At most one row per render. */
  pulse: boolean
}

export interface SessionsRoomModel {
  /** The live rows, in render order. */
  rows: readonly RosterRow[]
  archived: readonly RosterRow[]
  /** The `(n)` the footer spells. `archived.length`, named so the footer takes a count rather
   * than a list it does not render. */
  archivedCount: number
}

interface Selection {
  selectedId: string | null
  pulsingId: string | null
}

/** Whether a lifecycle's head is hot: a live (non-terminal) model whose head node is stalled on a
 * human. `null`/terminal models are never hot — there is no head to pulse. */
export function lifecycleIsHot(model: LifecycleModel | null): boolean {
  if (!model || model.terminal) return false
  return isHotHeadState(model.nodes[model.head])
}

/** Whether Argo merely observes this session, in which case its status degrades away rather than
 * being faked (registry, Session status). `orphaned` takes the same shape: it is a posture on the
 * `managed | external` axis, not a state word (`cockpit-ui-inventory.md`). */
function isExternal(session: SessionView): boolean {
  return session.posture !== 'managed'
}

// A finished or merged session leaves the live rail for Archived by itself — `cockpit-spec.md` §4.1:
// "archiving is a status transition, never a button". Read off the facts rather than a flag: the
// lifecycle reached a terminal state, or the session's own process ended.
function hasLeftForArchived({ session, lifecycle }: Graded): boolean {
  return (lifecycle?.terminal ?? null) !== null || session.facts.status === 'ended'
}

/** Newest first, with an unobserved key last: never observed is not the same as most recent. */
function newerFirst(a: number | null, b: number | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

// Most-recent activity first, and STABLE: equal or unobserved keys keep the incoming order, so a
// session entering attention never jumps (§4.1 — the rail does not churn under you). Decorated with
// the incoming index and sorted over a fresh array, so neither the tie-break nor the caller's list
// depends on the engine's sort being stable. Status is deliberately absent from the key.
function byRecentActivity(sessions: readonly SessionView[]): SessionView[] {
  return sessions
    .map((session, index) => ({ session, index }))
    .sort(
      (a, b) => newerFirst(a.session.lastActivityAt, b.session.lastActivityAt) || a.index - b.index,
    )
    .map(({ session }) => session)
}

// At most one dot pulses per render, and only while the selected session's lifecycle is quiet —
// otherwise the Delivery rail owns the budget. Motion, never a second telling of the state: the
// state itself is still the dot's tone alone.
function pulsingRowId(graded: readonly Graded[], selectedId: string | null): string | null {
  const selected = graded.find((row) => row.session.id === selectedId)
  if (selected && lifecycleIsHot(selected.lifecycle)) return null
  return graded.find((row) => row.rail.dot.tone === 'amber')?.session.id ?? null
}

function rowFor({ session, rail }: Graded, selection: Selection): RosterRow {
  const external = isExternal(session)
  return {
    id: session.id,
    name: session.title,
    word: rail.word,
    dot: rail.dot,
    model: session.model ?? UNKNOWN,
    // An external row spells where it is working instead of a branch: Argo did not create its
    // checkout, so the path is the honest disambiguator.
    place: (external ? session.cwd : session.branch) ?? UNKNOWN,
    external,
    selected: session.id === selection.selectedId,
    pulse: session.id === selection.pulsingId,
  }
}

/** The rail's whole view-model: the live rows in render order, the archived ones, and their count.
 * Every session is graded exactly once, so the rail and the interior can never disagree. */
export function buildSessionsRoomModel({
  sessions,
  selectedId = null,
}: {
  /** The active project's observed sessions, in whatever order the projection holds them. */
  sessions: readonly SessionView[]
  /** The open session's id, or `null` for none. */
  selectedId?: string | null
}): SessionsRoomModel {
  const graded: Graded[] = byRecentActivity(sessions).map((session) => ({
    session,
    ...deliveryState(session.facts, session.posture),
  }))
  const selection: Selection = {
    selectedId,
    pulsingId: pulsingRowId(graded, selectedId),
  }
  const gone = graded.filter(hasLeftForArchived)
  return {
    rows: graded.filter((row) => !hasLeftForArchived(row)).map((row) => rowFor(row, selection)),
    archived: gone.map((row) => rowFor(row, selection)),
    archivedCount: gone.length,
  }
}
