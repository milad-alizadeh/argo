import {
  type LifecycleModel,
  lifecycleModel,
  type SessionFacts,
  type SessionPosture,
} from '@shared'
import { type RosterStatus, rosterStatus } from './preRegistryStatus'
import { type RailStatus, rosterWord, sessionDot } from './rosterStatus'

// One derivation per Session: the strip and the rail read the same lifecycle, so a
// caller has no way to render the two from facts that disagree.

export interface DeliveryState {
  // null = no lifecycle at all (R7): nothing has been produced for this Session to deliver.
  lifecycle: LifecycleModel | null
  rail: RailStatus
  /** DEAD ON ARRIVAL — the pre-registry row status, still rendered by `domains/roster` and
   * `SessionScreen` until issue 267 Phase C deletes them. Read `rail` instead. */
  roster: RosterStatus
}

// `posture` defaults to `managed` for the pre-registry callers above, which have no posture to
// hand over; every caller of `rail` states one.
export function deliveryState(
  facts: SessionFacts,
  posture: SessionPosture = 'managed',
): DeliveryState {
  const lifecycle = lifecycleModel(facts)
  return {
    lifecycle,
    rail: { word: rosterWord(facts, posture, lifecycle), dot: sessionDot(facts, posture) },
    roster: rosterStatus(facts, lifecycle),
  }
}
