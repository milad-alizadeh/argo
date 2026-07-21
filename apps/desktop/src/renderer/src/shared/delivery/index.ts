// The renderer's delivery-flow surface: the roster's presentation vocabulary and the `deliveryState`
// composition that binds it to the lifecycle. The lifecycle derivation itself is the cross-process
// contract (`@shared`) — main drives gates from the same pure code the roster reads — so this
// barrel consumes it rather than declaring it. `deliveryState` stays the only derivation entry
// point, so the lifecycle and the roster row can never disagree about a Session.

export { type DeliveryState, deliveryState } from './deliveryState'
export {
  ROSTER_ICONS,
  ROSTER_TONES,
  type RosterIcon,
  type RosterStatus,
  type RosterTone,
  SESSION_STATUS,
} from './rosterStatus'
export { STATE_MATRIX_ROWS, type StateMatrixRow, stateMatrixInput } from './stateMatrix'
