import type { SessionFacts } from '@shared'
import { type RailStatus, railStatus } from './railStatus'
import { type RibbonModel, ribbonModel } from './ribbonModel'

// One derivation per Session: the strip and the row read the same ribbon, so a
// caller has no way to render the two from facts that disagree.

export interface ShipState {
  // null = no ribbon at all (R7): nothing has been produced for this Session to ship.
  ribbon: RibbonModel | null
  rail: RailStatus
}

export function shipState(facts: SessionFacts): ShipState {
  const ribbon = ribbonModel(facts)
  return { ribbon, rail: railStatus(facts, ribbon) }
}
