// The Sessions room's ONE public entry (apps/desktop/scripts/module-boundaries.json). The renderer
// root composes the room from here and `cockpit/` reads the derivations; everything else inside
// `rooms/sessions/` is private. The room is a pure View: the store and the bridge are read on the
// composition root's side of the seam, which is why the models and the layout hook leave through
// this barrel rather than reaching for state themselves.

export {
  type IntentChip,
  type MetaSegment,
  noSessionLink,
  type SessionHeaderModel,
  type SessionIntent,
  type SessionLink,
  type SessionMode,
  type TitleSource,
} from '../interiorHeader'
export {
  buildSessionInterior,
  DEFAULT_INTERIOR_UI,
  INTERIOR_TABS,
  type InteriorTab,
  type InteriorUiState,
  type SessionInteriorModel,
} from '../interiorModel'
export {
  buildSessionsRoomModel,
  type RosterRow,
  type SessionsRoomModel,
} from '../sessionsRoomModel'
export {
  isDockExpanded,
  SPINE,
  type SpineEdge,
  type SpineLayout,
  useSpineLayout,
} from '../useSpineLayout'
export { Roster } from './Roster'
export { SessionScreen, type SessionScreenHandlers } from './SessionScreen'
