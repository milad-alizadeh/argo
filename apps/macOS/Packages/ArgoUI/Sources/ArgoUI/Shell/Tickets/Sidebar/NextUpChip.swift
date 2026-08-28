import SwiftUI

/// One earned reason on the Next-up hero (`cockpit-work-room.md` — the Next-up hero).
///
/// A label and not a control of its own: pressing it would filter to something the reader did not
/// ask for. Since #898 it sits INSIDE one — the card is the button, so a press here opens the
/// ticket the chip is a reason for, which is the one act the whole card has.
struct NextUpChip: View {
    @Environment(\.argo) private var argo

    /// Either side of the word. The line box already stands clear above and below it, so the
    /// vertical inset is the smallest step rather than a match for this one.
    static let insetX: CGFloat = ArgoSpacing.snug
    static let insetY: CGFloat = ArgoSpacing.hair

    let reason: NextUp.Reason

    var body: some View {
        Text(reason.words)
            .argoText(ArgoTypography.badge)
            .foregroundStyle(ink)
            .lineLimit(1)
            .padding(.horizontal, Self.insetX)
            .padding(.vertical, Self.insetY)
            .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.marker))
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .strokeBorder(edge, lineWidth: ArgoStroke.hairline)
            }
    }

    private var ink: ArgoColor {
        reason.isUrgent ? argo.color.state.attention : argo.color.text.secondary
    }

    /// The urgent chip's edge is its own hue at rim strength, so the ink and the boundary say one
    /// thing. Every other chip takes the neutral hairline.
    private var edge: ArgoColor {
        reason.isUrgent
            ? argo.color.state.rim(argo.color.state.attention)
            : argo.color.edge.hairline
    }
}

#Preview("Next-up chips — the urgent one, and the neutral ones beside it") {
    HStack(spacing: ArgoSpacing.snug) {
        NextUpChip(reason: .highPriority)
        NextUpChip(reason: .unblocked)
        NextUpChip(reason: .next(chart: "#607"))
        NextUpChip(reason: .oldestUntouched)
    }
    .padding(ArgoSpacing.comfortable)
    .argoDeckSurface()
    .argoAppearance()
}
