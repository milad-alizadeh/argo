import SwiftUI

/// One segment of a toolbar vessel — a room tab, the Project half, the checkout half.
///
/// It is the same control in three places, so the wash, the paddings and the hit shape live here
/// once. Spelled out per call site they drift, and AppKit's own menu fill is not this shape.
struct ToolbarSegment: ViewModifier {
    /// What the segment is measured around. A word needs room at its two ends; a mark needs the
    /// same room on all four, or the `Capsule` below draws a stretched pill inside the vessel's
    /// stadium and the two curves visibly disagree (#690).
    enum Fit {
        case label
        case mark
    }

    /// How tall a mark's slot is: the vessel less the inset `RoomsVessel` holds it off the rim by.
    /// That is what makes the wash's end caps concentric with the vessel's own — the cap radius is
    /// half this, and half this plus the inset is the vessel's radius. Any other height and the two
    /// curves disagree, which is what a reader sees as a mismatched corner radius (#690).
    static let markSlotHeight = ArgoLayout.toolbarVesselHeight - 2 * ArgoSpacing.snug

    /// Wider than it is tall, by that same inset. A square pinched the widest mark against its own
    /// wash: `ArgoGlyph` fixes HEIGHT and lets width follow, and `apple.terminal` is a broad mark.
    /// FIXED, so the three rooms take one measure — on intrinsic widths the wash would change size
    /// as the selection moved between them.
    static let markSlotWidth = markSlotHeight + ArgoSpacing.snug

    @Environment(\.argo) private var argo

    let isSelected: Bool
    let fit: Fit

    func body(content: Content) -> some View {
        content
            .modifier(SegmentMeasure(fit: fit))
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

/// The two measures, split out so `body` above stays one statement per thing it does.
private struct SegmentMeasure: ViewModifier {
    let fit: ToolbarSegment.Fit

    func body(content: Content) -> some View {
        switch fit {
        case .label:
            content
                .padding(.horizontal, ArgoSpacing.comfortable)
                .padding(.vertical, ArgoSpacing.snug)
        case .mark:
            // On the SLOT and not as padding round the ink: the mark keeps its own intrinsic width
            // and is centred, where padding would hand each mark a slot of a different size.
            content.frame(
                width: ToolbarSegment.markSlotWidth,
                height: ToolbarSegment.markSlotHeight,
            )
        }
    }
}

extension View {
    /// `isSelected` is false for a segment that opens a menu rather than holding a selection —
    /// it still takes the segment's measure, so the halves of one vessel line up.
    func toolbarSegment(isSelected: Bool = false, fit: ToolbarSegment.Fit = .label) -> some View {
        modifier(ToolbarSegment(isSelected: isSelected, fit: fit))
    }
}

// Every segment the bar draws: a selected mark, an unselected one, and the two word halves.
#Preview("Toolbar segments") {
    HStack(spacing: ArgoSpacing.hair) {
        ArgoGlyph(ArgoSymbol.sessionsRoom, .control)
            .toolbarSegment(isSelected: true, fit: .mark)
        ArgoGlyph(ArgoSymbol.workRoom, .control).toolbarSegment(fit: .mark)
        Text("Sessions").argoText(ArgoTypography.control).toolbarSegment(isSelected: true)
        Text("argo").argoText(ArgoTypography.rowTitle).toolbarSegment()
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
