// The Sessions room's ONE public entry (apps/desktop/scripts/module-boundaries.json). The renderer
// root composes the room from here and `cockpit/` reads the derivations; everything else inside
// `rooms/sessions/` is private. The room is a pure View: the store and the bridge are read on the
// composition root's side of the seam, which is why the model and the layout hook leave through
// this barrel rather than reaching for state themselves.
export {
  buildSessionsRoomModel,
  type RosterRow,
  type SessionsRoomModel,
} from '../sessionsRoomModel'
export {
  isConsoleExpanded,
  SPINE,
  type SpineEdge,
  type SpineLayout,
  useSpineLayout,
} from '../useSpineLayout'
export { Roster } from './Roster'
