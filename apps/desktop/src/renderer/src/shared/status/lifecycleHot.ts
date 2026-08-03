import type { LifecycleNodeState } from '@shared'

// The single home of "which lifecycle states are stalled on a human" — the states the Delivery
// strip's head node pulses on (`LifecycleNode`). It lives here rather than in that component so a
// second surface reading the lifecycle cannot spell the set differently. The rail no longer asks:
// a session's dot pulses on its own state, not on whether the lifecycle is louder.
const HOT_HEAD_STATES: readonly LifecycleNodeState[] = ['gate', 'fail', 'warn']

/** Whether a node in this state is stalled on a human — `gate`/`fail`/`warn`. */
export function isHotHeadState(state: LifecycleNodeState): boolean {
  return HOT_HEAD_STATES.includes(state)
}
