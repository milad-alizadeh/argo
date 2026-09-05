import ArgoAtoms
import ArgoDesign
import ArgoUI
import SwiftUI

/// The window's own furniture: the shell the contract is dressed onto, the roster in each state it
/// reaches, and the two containers a Project is picked from.
extension SpecimenRegistry {
    static let roster: [SpecimenEntry] = [
        SpecimenEntry("foundations") { FoundationSpecimen() },
        SpecimenEntry("contract") { ContractSpecimen() },
        // The same coverage with the optical response gone: a role judged on glass alone is a role
        // nobody has looked at on the ground half the readers will see it on.
        SpecimenEntry("flatContract") { ContractSpecimen().argoWithoutTransparency() },
        // The map's own five families (#1142), on the desktop rather than the deck — the ground
        // they are really read against, and one no other room has.
        SpecimenEntry("atlasContract") { AtlasContractSpecimen() },
        // The contract's icon buttons, on a sheet of their own: the sheet above is longer than any
        // window, and a section nobody can render is not the drift check #1243 asked for.
        SpecimenEntry("iconButtons") { IconButtonSpecimen() },
        // The map as it ships: this repository standing up, drawn by the shader (#1150).
        // Rendered from the running app rather than a preview, because what is being asked is
        // whether the SHIPPED binary carries a compiled shader at all.
        SpecimenEntry("atlasCity") { AtlasMapSpecimen() },
        // The SAME camera at its flat end, which is the whole claim the two views rest on: this
        // frame and the one above are one drawing with one number changed, and if the flat one
        // ever stops being the treemap it is this pair that shows it.
        SpecimenEntry("atlasTreemap") { AtlasMapSpecimen(relief: 0) },
        // The map before anything has been scanned: the floor, and no city on it. Worth a render
        // rather than an assertion, because it is also what every way Metal can be ABSENT degrades
        // to — so this is the frame the one above is told apart from.
        SpecimenEntry("emptyAtlas") { AtlasMapSpecimen(map: nil) },
        // The same picture inside the ROOM: the strip that says what was measured, and the page a
        // Project with no atlas gets instead (#1148). The treemap above is the drawing on its own.
        SpecimenEntry("atlasRoom") { AtlasRoomSpecimen() },
        SpecimenEntry("atlasRoomUnmeasured") { AtlasRoomVacancySpecimen() },
        // The other two readings with no map to draw, and the one where an old map still draws
        // (#1162). `pixel-review` judges the first two against #650's approved renders; the third
        // has none — the design draws no stale state — so it is a look, not a diff.
        SpecimenEntry("atlasRoomLoading") { AtlasRoomLoadingSpecimen() },
        SpecimenEntry("atlasRoomError") { AtlasRoomErrorSpecimen() },
        SpecimenEntry("atlasRoomStale") { AtlasRoomStaleSpecimen() },
        SpecimenEntry("sessionRows") { SessionRowsSpecimen() },
        // Where the identity is spent (#875, narrowed by #944): the roster's selected row and the
        // rooms picker, in one frame and on an ACTIVE window — an inactive one draws selection in
        // the system's neutral grey whatever the accent says, so an inactive render here proves
        // nothing about either.
        SpecimenEntry("selectedRow") { SelectedRowSpecimen() },
        // The strip at the sidebar's narrowest — where its four segments have least room, and
        // where a fifth room would first go wrong (#1163).
        SpecimenEntry("narrowRoomStrip") { NarrowRoomStripSpecimen() },
        SpecimenEntry("turnClock") { TurnClockRosterSpecimen() },
        // The travel only shows in motion; a still catches the light at one point along it, and
        // catches four rows at four different points (#1291).
        SpecimenEntry("rosterSecondLine") { RosterSecondLineSpecimen() },
        SpecimenEntry("rosterSecondLineStill") { RosterSecondLineSpecimen(isStill: true) },
        // The trailing edge of line 3 (#1346): an open, a merged, a closed and a draft pull
        // request beside their Ticket, and a row with neither address.
        SpecimenEntry("deliveryAddresses") { DeliveryAddressesRosterSpecimen() },
        // Every shape the roster's `PlanBar` comes in: mid-flight, complete, frozen and none
        // (#1345).
        SpecimenEntry("planBarRoster") { PlanBarRosterSpecimen() },
        SpecimenEntry("ghostedRows") { GhostedRosterSpecimen() },
        SpecimenEntry("roster") { RosterSpecimen() },
        // #1404: a roster longer than the window, which no other entry here carries — the state the
        // `Group` in the sidebar column halved, so eight rows drew and the rest of the pane was the
        // hidden Tickets sidebar's ground. Judged on the LAST row, not the first.
        SpecimenEntry("manyMixedRoster") { ManyMixedRosterSpecimen() },
        // The leading column's four Subagent readings and the ceiling, one row each (#1344).
        SpecimenEntry("subagentDots") { SubagentDotsRosterSpecimen() },
        SpecimenEntry("churningRoster") { ChurningRosterSpecimen() },
        // The strip's edge, which only a SCROLLED roster can be judged on: at rest the first row
        // sits flush with the control whether the list clips there or not (#1235).
        SpecimenEntry("scrolledRoster") { ScrolledRosterSpecimen() },
        // A Session landing at the head of a roster longer than the window, from the top and from
        // a reader's own offset (#1235). Rendered after the arrival, with the hold let go, so the
        // offset in the picture is the list's own answer rather than the harness's.
        SpecimenEntry("arrivingRoster") { ArrivingRosterSpecimen() },
        SpecimenEntry("arrivingScrolledRoster") { ArrivingRosterSpecimen(offset: 220) },
        // No swiped-row entry: `.swipeActions` opens only from a real gesture, so there is no state
        // to hand the harness. Nor is it an XCUITest claim: neither `XCUIElement.scroll(byDeltaX:)`
        // nor a phased `CGEvent` scroll opens the action, so it is a hand's frame or nothing
        // (#1257).
        SpecimenEntry("archivedRoster") { ArchivedRosterSpecimen() },
        // Reachable only by clicking the foot.
        SpecimenEntry("openArchivedRoster") { ArchivedRosterSpecimen(isRevealed: true) },
        // The foot open because it HOLDS the selection, with nothing having clicked it: the state
        // archiving the row being read lands in, and the one the foot may not be shut in.
        SpecimenEntry("archivedSelectionRoster") {
            ArchivedRosterSpecimen(selection: "archived-old")
        },
        // The one entry whose point is the CLICK: driven, so New Session must land a row.
        SpecimenEntry("spawningRoster") { SpawningRosterSpecimen() },
        SpecimenEntry("renamedRoster") { RenamedRosterSpecimen() },
        SpecimenEntry("ticketRoster") { TicketRosterSpecimen() },
        // The same rows where the shared title cuts, which is the only render that answers whether
        // the secondary line is enough to tell three Sessions on one ticket apart.
        SpecimenEntry("narrowTicketRoster") {
            TicketRosterSpecimen(width: ArgoLayout.sidebarMinimumWidth)
        },
        // A caption loop's 180 headless runs on one row (#1073), shut and opened. The state it
        // replaces cannot be photographed usefully: 180 near-identical rows past the window's foot.
        SpecimenEntry("foldedRoster") { FoldedRosterSpecimen() },
        SpecimenEntry("openFoldedRoster") { FoldedRosterSpecimen(isOpened: true) },
        SpecimenEntry("editingRow") { EditingRowSpecimen() },
        // A pane's state must die with its Session, which `FeedRow.ID` being a POSITION otherwise
        // carries across.
        SpecimenEntry("twoReadings") { RosterSpecimen(presentation: .twoReadings) },
        // Five readings and a cap of six decks: what a reader browsing actually does, and the state
        // the kept decks are driven through (ADR-0030, Rule 4).
        SpecimenEntry("fiveReadings") { RosterSpecimen(presentation: .fiveReadings) },
        SpecimenEntry("toolbarScope") { ToolbarSpecimen(presentation: .preview) },
        SpecimenEntry("emptyToolbarScope") { ToolbarSpecimen(presentation: .unregisteredPreview) },
        // The bar's two degrade-down states — `emptyPreview` is the one fixture on a detached HEAD.
        SpecimenEntry("unreachableToolbarScope") {
            ToolbarSpecimen(presentation: .unreachablePreview)
        },
        SpecimenEntry("detachedToolbarScope") { ToolbarSpecimen(presentation: .emptyPreview) },
        // The verb while it is being carried out — the first spawn of a window waits on a login
        // shell reporting a `PATH`, and until this state existed that wait looked exactly like a
        // press that did nothing.
        SpecimenEntry("startingSpawn") { SpecimenScene.centred { SpecimenScene.startingSpawn } },
    ]
}
