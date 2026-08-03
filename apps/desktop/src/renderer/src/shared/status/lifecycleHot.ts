import type { LifecycleNodeState } from '@shared'

// The single home of "which lifecycle states are stalled on a human" — the states that spend the
// screen's one pulse budget (R10). Both surfaces that pulse read the set here: the Delivery strip's
// head node (`LifecycleNode`) and, when that head is quiet, the rail's top needs-you dot
// (`rooms/sessions/sessionsRoomModel.ts`, which owns the rail's own `lifecycleIsHot`). Spelling the
// set in two places is how the two would silently drift apart.
const HOT_HEAD_STATES: readonly LifecycleNodeState[] = ['gate', 'fail', 'warn']

/** Whether a node in this state is stalled on a human — `gate`/`fail`/`warn`. */
export function isHotHeadState(state: LifecycleNodeState): boolean {
  return HOT_HEAD_STATES.includes(state)
}
