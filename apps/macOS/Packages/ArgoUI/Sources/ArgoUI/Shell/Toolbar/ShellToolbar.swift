import SwiftUI

/// Two jobs in two places: scope at the leading edge, navigation pinned to the trailing one.
///
/// Scope is ONE toolbar item, because that is what the toolbar draws one Liquid Glass capsule
/// around — a `ToolbarItemGroup` gives each control in it a capsule of its own, which is the split
/// layout under another name.
///
/// The flexible spacer takes NO placement. Placed in `.navigation` it expanded inside the leading
/// group and pushed nothing across the bar, which is what left Rooms adrift beside the scope
/// vessel instead of at the trailing edge.
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
