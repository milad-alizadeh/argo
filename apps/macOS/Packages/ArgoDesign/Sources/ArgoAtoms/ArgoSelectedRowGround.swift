import ArgoDesign
import SwiftUI

public extension View {
    /// The ground under a selected sidebar row, in both rails. It COVERS
    /// `.listStyle(.sidebar)`'s own capsule, which on macOS 26 is a fixed neutral that neither
    /// `.tint` nor the `AccentColor` asset moves by a value (D30, as amended by #875, #906, #922).
    func argoSelectedRowGround(isSelected: Bool) -> some View {
        modifier(SelectedRowGround(isSelected: isSelected))
    }
}

/// A modifier and not a call at each site: a `listRowBackground` argument cannot read the
/// environment's palette.
private struct SelectedRowGround: ViewModifier {
    @Environment(\.argo) private var argo

    let isSelected: Bool

    func body(content: Content) -> some View {
        content.listRowBackground(ground.color)
    }

    /// Nothing at all under an unselected row — the sidebar's own system material is the surface
    /// D3 reserves for it.
    private var ground: ArgoColor {
        isSelected ? argo.color.interaction.selectionGround : .transparent
    }
}
