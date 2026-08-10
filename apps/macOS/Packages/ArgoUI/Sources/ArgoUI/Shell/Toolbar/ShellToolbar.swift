import SwiftUI

/// Two jobs in two places: scope at the leading edge, navigation pinned to the trailing one — with
/// the one verb the bar carries in front of both, beside the sidebar toggle.
///
/// New Session is NOT a third vessel (#433). The two bounded glass vessels each hold a compound
/// reading; a bare icon button in the leading group is the platform's own answer for "create the
/// thing this sidebar holds", and it sits at the weight of the toggle it stands next to.
///
/// Scope is ONE toolbar item, because that is what the toolbar draws one Liquid Glass capsule
/// around — a `ToolbarItemGroup` gives each control in it a capsule of its own, which is the split
/// layout under another name.
///
/// The flexible spacer is placed with Rooms, not between the two items. A spacer takes the bar
/// region its placement names, and an unplaced one resolves to the window's own — which in a
/// split view is not the region the detail pane draws, so it expanded where nothing was and left
/// Rooms adrift beside the scope vessel. Sharing `.primaryAction` puts it in front of Rooms
/// inside the region Rooms is in, which is the only place it can push from.
struct ShellToolbar: ToolbarContent {
    @Binding var room: CockpitRoom
    let presentation: CockpitPresentation
    let actions: CockpitActions
    let spawn: CockpitSpawn

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            NewSessionButton(offer: spawn.offer) { await spawn.run() }
        }
        .sharedBackgroundVisibility(.hidden)
        // Two things keep the verb OUT of the scope vessel, and it needs both. Adjacent items in
        // one region share a single Liquid Glass capsule, so without the hidden background the
        // button drew as a third segment of "this Project, on this checkout" — a fourth fact
        // inside a reading of three — and without the spacer it sat hard against the folder mark.
        ToolbarSpacer(.fixed, placement: .navigation)
        ToolbarItem(placement: .navigation) {
            ScopeVessel(presentation: presentation, actions: actions)
        }
        ToolbarSpacer(.flexible)
        ToolbarItem(placement: .primaryAction) {
            RoomsVessel(selection: $room)
        }
    }
}
