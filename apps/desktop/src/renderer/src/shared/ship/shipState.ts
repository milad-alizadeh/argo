import { type LifecycleModel, lifecycleModel, type SessionFacts } from '@shared'
import { type RailStatus, railStatus } from './railStatus'

// One derivation per Session: the strip and the row read the same ribbon, so a
// caller has no way to render the two from facts that disagree.

export interface ShipState {
  // null = no ribbon at all (R7): nothing has been produced for this Session to ship.
  ribbon: LifecycleModel | null
  rail: RailStatus
}

export function shipState(facts: SessionFacts): ShipState {
  const ribbon = lifecycleModel(facts)
  return { ribbon, rail: railStatus(facts, ribbon) }
}
