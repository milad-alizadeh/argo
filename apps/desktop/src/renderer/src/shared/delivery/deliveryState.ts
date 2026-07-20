import { type LifecycleModel, lifecycleModel, type SessionFacts } from '@shared'
import { type RosterStatus, rosterStatus } from './rosterStatus'

// One derivation per Session: the strip and the row read the same ribbon, so a
// caller has no way to render the two from facts that disagree.

export interface DeliveryState {
  // null = no ribbon at all (R7): nothing has been produced for this Session to deliver.
  ribbon: LifecycleModel | null
  roster: RosterStatus
}

export function deliveryState(facts: SessionFacts): DeliveryState {
  const ribbon = lifecycleModel(facts)
  return { ribbon, roster: rosterStatus(facts, ribbon) }
}
