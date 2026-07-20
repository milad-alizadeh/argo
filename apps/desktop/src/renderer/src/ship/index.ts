// The pure ship-flow derivation: session facts in, render state out. `shipState` is the
// only derivation entry point, so the ribbon and the rail row can never disagree about a
// Session. The lifecycle vocabulary (`SESSION_STATUS`) ships beside it because a View that
// re-spells a word is the drift this module exists to prevent. The facts it derives from
// are the cross-process contract (`@shared`), not this module's to declare.

export {
  RAIL_TONES,
  type RailIcon,
  type RailStatus,
  type RailTone,
  SESSION_STATUS,
} from './railStatus'
export {
  RIBBON_KEYS,
  type RibbonModel,
  type RibbonNodeKey,
  type RibbonNodeState,
  type RibbonNodes,
  type TerminalState,
} from './ribbonModel'
export { type ShipState, shipState } from './shipState'
