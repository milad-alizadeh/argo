import SwiftUI

/// Two jobs in two places: scope at the leading edge, navigation pinned to the trailing one.
///
/// Scope is ONE toolbar item, because that is what the toolbar draws one Liquid Glass capsule
/// around — a `ToolbarItemGroup` gives each control in it a capsule of its own, which is the split
/// layout under another name.
struct ShellToolbar: ToolbarContent {
    @Binding var room: CockpitRoom
    let presentation: CockpitPresentation
    let actions: CockpitActions

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            ScopeVessel(presentation: presentation, actions: actions)
        }
        ToolbarSpacer(.flexible, placement: .navigation)
        ToolbarItem(placement: .primaryAction) {
            RoomsVessel(selection: $room)
        }
    }
}
