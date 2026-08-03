import {
  type LifecycleModel,
  lifecycleModel,
  type SessionFacts,
  type SessionPosture,
} from '@shared'
import { type RailStatus, rosterWord, sessionDot } from './rosterStatus'

// One derivation per Session: the strip and the rail read the same lifecycle, so a
// caller has no way to render the two from facts that disagree.

export interface DeliveryState {
  // null = no lifecycle at all (R7): nothing has been produced for this Session to deliver.
  lifecycle: LifecycleModel | null
  rail: RailStatus
}

// `posture` is required: which word a row earns depends on whether Argo drives the Session or only
// watches it, and a default would let a caller fabricate a state word for a session it never owned.
export function deliveryState(facts: SessionFacts, posture: SessionPosture): DeliveryState {
  const lifecycle = lifecycleModel(facts)
  return {
    lifecycle,
    rail: { word: rosterWord(facts, posture, lifecycle), dot: sessionDot(facts, posture) },
  }
}
