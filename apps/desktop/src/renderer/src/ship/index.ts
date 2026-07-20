// The pure ship-flow derivation: session facts in, render state out. `shipState` is
// the only entry point, so the ribbon and the rail row can never disagree about a
// Session — the leaf derivations stay internal to this module. The facts it derives
// from are the cross-process contract (`@shared`), not this module's to declare.

export type { RailIcon, RailStatus, RailTone } from './railStatus'
export {
  RIBBON_KEYS,
  type RibbonModel,
  type RibbonNodeKey,
  type RibbonNodeState,
  type RibbonNodes,
  type TerminalState,
} from './ribbonModel'
export { type ShipState, shipState } from './shipState'
