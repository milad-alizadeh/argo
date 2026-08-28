import SwiftUI

/// The ground under a selected sidebar row, and the one place either sidebar asks for it.
///
/// Shared because the two rails are one decision: the roster and the Work room's view list both
/// replace `.listStyle(.sidebar)`'s own capsule, which on macOS 26 is a fixed neutral that neither
/// `.tint` nor the `AccentColor` asset moves by a value (D30, as amended by #875 and #906).
enum ArgoSelectedRowGround {
    /// The brand wash when the row is selected, and nothing at all otherwise — an unselected row is
    /// the sidebar's own system material, which is the surface D3 reserves for it.
    static func ground(isSelected: Bool, in palette: ArgoPalette) -> ArgoColor {
        isSelected ? palette.interaction.selectionGround : .transparent
    }
}

extension View {
    /// Draws the row's ground as a `listRowBackground`, which REPLACES the style's capsule rather
    /// than stacking a second highlight on it. Carried by the ground alone: no leading rule, no bar
    /// down the edge — the design retired that and it stays retired.
    func argoSelectedRowGround(isSelected: Bool) -> some View {
        modifier(SelectedRowGround(isSelected: isSelected))
    }
}

/// Its own modifier and not a call at each site, because the ground needs the environment's palette
/// and a `listRowBackground` argument cannot read one.
private struct SelectedRowGround: ViewModifier {
    @Environment(\.argo) private var argo

    let isSelected: Bool

    func body(content: Content) -> some View {
        content.listRowBackground(
            ArgoSelectedRowGround.ground(isSelected: isSelected, in: argo.color).color,
        )
    }
}
