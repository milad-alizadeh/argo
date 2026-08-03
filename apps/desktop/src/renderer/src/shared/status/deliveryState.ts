import { type LifecycleModel, lifecycleModel, type SessionFacts } from '@shared'
import { type RosterStatus, rosterStatus } from './rosterStatus'

// One derivation per Session: the strip and the row read the same lifecycle, so a
// caller has no way to render the two from facts that disagree.

export interface DeliveryState {
  // null = no lifecycle at all (R7): nothing has been produced for this Session to deliver.
  lifecycle: LifecycleModel | null
  roster: RosterStatus
}

export function deliveryState(facts: SessionFacts): DeliveryState {
  const lifecycle = lifecycleModel(facts)
  return { lifecycle, roster: rosterStatus(facts, lifecycle) }
}
