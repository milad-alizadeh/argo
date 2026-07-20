// The renderer's ship-flow surface: the rail's presentation vocabulary and the `shipState`
// composition that binds it to the ribbon. The ribbon derivation itself is the cross-process
// contract (`@shared`) — main drives gates from the same pure code the rail reads — so this
// barrel consumes it rather than declaring it. `shipState` stays the only derivation entry
// point, so the ribbon and the rail row can never disagree about a Session.

export {
  RAIL_TONES,
  type RailIcon,
  type RailStatus,
  type RailTone,
  SESSION_STATUS,
} from './railStatus'
export { type ShipState, shipState } from './shipState'
