import SwiftUI

/// Two jobs in two places: scope at the leading edge, navigation pinned to the trailing one.
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

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            ScopeVessel(presentation: presentation, actions: actions)
        }
        ToolbarSpacer(.flexible)
        ToolbarItem(placement: .primaryAction) {
            RoomsVessel(selection: $room)
        }
    }
}
