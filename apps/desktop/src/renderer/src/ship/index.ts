// The pure ship-flow derivation: session facts in, render state out. `shipState` is
// the only entry point, so the ribbon and the rail row can never disagree about a
// Session — the leaf derivations stay internal to this module.

export type { RailIcon, RailStatus, RailTone } from './railStatus'
export {
  RIBBON_KEYS,
  type RibbonModel,
  type RibbonNodeKey,
  type RibbonNodeState,
  type RibbonNodes,
  type TerminalState,
} from './ribbonModel'
export type {
  CiFacts,
  CiStatus,
  GatePolicy,
  PrFacts,
  PrLifecycle,
  ReviewRound,
  ReviewVerdict,
  SessionFacts,
  SessionLifecycle,
  SessionPolicy,
} from './sessionFacts'
export { type ShipState, shipState } from './shipState'
