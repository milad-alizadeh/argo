import SwiftUI

/// The window's own furniture: the shell the contract is dressed onto, the roster in each state it
/// reaches, and the two containers a Project is picked from.
extension SpecimenRegistry {
    static let roster: [SpecimenEntry] = [
        SpecimenEntry("foundations") { FoundationSpecimen() },
        SpecimenEntry("contract") { ContractSpecimen() },
        SpecimenEntry("sessionRows") { SessionRowsSpecimen() },
        SpecimenEntry("turnClock") { TurnClockRosterSpecimen() },
        SpecimenEntry("ghostedRows") { GhostedRosterSpecimen() },
        SpecimenEntry("roster") { RosterSpecimen() },
        SpecimenEntry("churningRoster") { ChurningRosterSpecimen() },
        // No swiped-row entry: `.swipeActions` opens only from a real gesture, so there is no state
        // to hand the harness. It is an XCUITest claim (`ArgoE2ETests`), not a PNG.
        SpecimenEntry("archivedRoster") { ArchivedRosterSpecimen() },
        // Reachable only by clicking the foot.
        SpecimenEntry("openArchivedRoster") { ArchivedRosterSpecimen(isRevealed: true) },
        // The one entry whose point is the CLICK: driven, so New Session must land a row.
        SpecimenEntry("spawningRoster") { SpawningRosterSpecimen() },
        SpecimenEntry("renamedRoster") { RenamedRosterSpecimen() },
        SpecimenEntry("ticketRoster") { TicketRosterSpecimen() },
        // The same rows where the shared title cuts, which is the only render that answers whether
        // the secondary line is enough to tell three Sessions on one ticket apart.
        SpecimenEntry("narrowTicketRoster") {
            TicketRosterSpecimen(width: ArgoLayout.sidebarMinimumWidth)
        },
        SpecimenEntry("editingRow") { EditingRowSpecimen() },
        // A pane's state must die with its Session, which `FeedRow.ID` being a POSITION otherwise
        // carries across.
        SpecimenEntry("twoReadings") { RosterSpecimen(presentation: .twoReadings) },
        SpecimenEntry("toolbarScope") { ToolbarSpecimen(presentation: .preview) },
        SpecimenEntry("emptyToolbarScope") { ToolbarSpecimen(presentation: .unregisteredPreview) },
        SpecimenEntry("projectDrawer") { DrawerSpecimen(presentation: .preview) },
        SpecimenEntry("unreachableProjectDrawer") {
            DrawerSpecimen(presentation: .unreachablePreview)
        },
        SpecimenEntry("emptyProjectDrawer") { DrawerSpecimen(presentation: .unregisteredPreview) },
        SpecimenEntry("openProjectDrawer") { OpenDrawerSpecimen() },
        // The verb while it is being carried out — the first spawn of a window waits on a login
        // shell reporting a `PATH`, and until this state existed that wait looked exactly like a
        // press that did nothing.
        SpecimenEntry("startingSpawn") { SpecimenScene.centred { SpecimenScene.startingSpawn } },
    ]
}
