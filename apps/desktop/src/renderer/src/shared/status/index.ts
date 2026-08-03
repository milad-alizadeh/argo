// The status presentation vocabulary every room reads: the registry-derived word/dot derivation
// and the `deliveryState` composition that binds it to the lifecycle. That derivation is the
// cross-process contract (`@shared`) — main drives gates from the same pure code the rail reads —
// so this barrel consumes it rather than declaring it. `deliveryState` stays the only derivation
// entry point, so the lifecycle and the rail row can never disagree about a Session.

export { type DeliveryState, deliveryState } from './deliveryState'
export { isHotHeadState } from './lifecycleHot'
export {
  type DeliveryClaim,
  DOT_GLOWS,
  type DotGlow,
  deliveryClaimWord,
  type RailStatus,
  ROSTER_ICONS,
  ROSTER_TONES,
  type RosterIcon,
  type RosterTone,
  type RosterWord,
  rosterWord,
  type SessionDot,
  type SessionWord,
  sessionDot,
  sessionStatusWord,
} from './rosterStatus'
export { STATE_MATRIX_ROWS, type StateMatrixRow, stateMatrixInput } from './stateMatrix'
