import SwiftUI

/// Two jobs in two places: scope at the leading edge, navigation pinned to the trailing one — with
/// the one verb the bar carries in front of both, beside the sidebar toggle.
///
/// New Session is NOT a third vessel (#433): the verb carries a small glass of its own.
///
/// Scope is ONE toolbar item, because that is what the toolbar draws one Liquid Glass capsule
/// around — a `ToolbarItemGroup` gives each control in it a capsule of its own.
///
/// The flexible spacer is placed with Rooms, not between the two items. A spacer takes the bar
/// region its placement names, and an unplaced one resolves to the window's own — which in a split
/// view is not the region the detail pane draws, so it expands where nothing is and leaves Rooms
/// adrift. Sharing `.primaryAction` puts it inside the region Rooms is in.
///
/// The Session's title is NOT a toolbar item (#692). `.principal` is a slot between the regions,
/// not a centring: it parked the title against the scope vessel and pushed Rooms into the bar's
/// overflow menu. The title is drawn by `DeckCanopy`, which is the detail pane itself and already
/// reaches up into this band.
struct ShellToolbar: ToolbarContent {
    @Binding var room: CockpitRoom
    /// Assembled by the caller: nothing below the bar reads a presentation.
    let scope: ScopeVessel
    let spawn: CockpitSpawn

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            NewSessionButton(offer: spawn.offer) { await spawn.run() }
        }
        .sharedBackgroundVisibility(.hidden)
        // Adjacent items in one region share a single Liquid Glass capsule. The item hides that
        // shared background and draws its own; this spacer keeps it off the folder mark beside it.
        ToolbarSpacer(.fixed, placement: .navigation)
        ToolbarItem(placement: .navigation) {
            scope
        }
        ToolbarSpacer(.flexible)
        ToolbarItem(placement: .primaryAction) {
            RoomsVessel(selection: $room)
        }
    }
}
