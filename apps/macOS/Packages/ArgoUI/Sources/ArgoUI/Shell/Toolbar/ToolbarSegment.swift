import SwiftUI

/// One segment of a toolbar vessel — a room tab, the Project half, the checkout half.
///
/// It is the same control in three places, so the wash, the paddings and the hit shape live here
/// once. Spelled out per call site they drift, and AppKit's own menu fill is not this shape.
struct ToolbarSegment: ViewModifier {
    @Environment(\.argo) private var argo

    let isSelected: Bool

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, ArgoSpacing.comfortable)
            .padding(.vertical, ArgoSpacing.snug)
            // After the padding, never before it: a background applied to the label alone sizes to
            // the glyphs and leaves the wash hugging the text.
            .background(wash)
            .contentShape(.capsule)
    }

    /// A capsule, like the vessel it sits in — a rounded rectangle reads as a second control.
    private var wash: some View {
        Capsule()
            .fill(argo.color.surface.selected)
            .overlay {
                Capsule().strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
            }
            .opacity(isSelected ? 1 : 0)
    }
}

extension View {
    /// `isSelected` is false for a segment that opens a menu rather than holding a selection —
    /// it still takes the segment's measure, so the halves of one vessel line up.
    func toolbarSegment(isSelected: Bool = false) -> some View {
        modifier(ToolbarSegment(isSelected: isSelected))
    }
}

// The three segments the bar actually draws: a selected tab, an unselected one, and a menu half.
#Preview("Toolbar segments") {
    HStack(spacing: ArgoSpacing.hair) {
        Text("Sessions").argoText(ArgoTypography.control).toolbarSegment(isSelected: true)
        Text("Work").argoText(ArgoTypography.control).toolbarSegment()
        Text("argo").argoText(ArgoTypography.rowTitle).toolbarSegment()
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
