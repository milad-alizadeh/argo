import ArgoDesign
import SwiftUI

public extension View {
    /// The ground under a selected row — in both rails and, since #1165, in the backlog too — and
    /// the ONLY selection paint in that row. The list style's own fill, which on macOS 26 neither
    /// `.tint` nor the `AccentColor` asset moves by a value (D30, as amended by #875, #906, #922),
    /// is switched off at the table by the probe this carries (`ListSelectionFill`, #1137): the
    /// platform paints the pressed row on mouse-down, and the binding this ground follows moves on
    /// mouse-up.
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
        content
            // Under the content, where the walk up to the table stays inside the cell. It hit-tests
            // nothing and draws nothing, so the row is exactly what it was.
            .background { ListSelectionFillProbe() }
            .listRowBackground(ground.color)
    }

    /// Nothing at all under an unselected row — the list's own surface, which in a rail is the
    /// system material D3 reserves for it and in the backlog is the deck.
    private var ground: ArgoColor {
        isSelected ? argo.color.interaction.selectionGround : .transparent
    }
}
