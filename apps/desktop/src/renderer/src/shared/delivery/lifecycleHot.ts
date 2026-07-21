import type { LifecycleModel, LifecycleNodeState } from '@shared'

// The single home of "which lifecycle states are stalled on a human" — the states that spend the
// screen's one pulse budget (R10). Both surfaces that pulse read it here: the Delivery strip's
// head node (`LifecycleNode`) and, when that head is quiet, the roster's top needs-you dot
// (`Roster`). Spelling the set in two places is how the two would silently drift apart.
const HOT_HEAD_STATES: readonly LifecycleNodeState[] = ['gate', 'fail', 'warn']

/** Whether a node in this state is stalled on a human — `gate`/`fail`/`warn`. */
export function isHotHeadState(state: LifecycleNodeState): boolean {
  return HOT_HEAD_STATES.includes(state)
}

/** Whether a lifecycle's head is hot: a live (non-terminal) model whose head node is stalled on a
 * human. `null`/terminal models are never hot — there is no head to pulse. */
export function lifecycleIsHot(model: LifecycleModel | null): boolean {
  if (!model || model.terminal) return false
  return isHotHeadState(model.nodes[model.head])
}
