import SwiftUI

/// One option while the question waits — the thing you press. Its number, its words, the line under
/// them, and a box where the question takes more than one.
///
/// The number is `FeedMarker`, exactly as the settled reading numbers its options: a pressable
/// option and a read one carry the same digit in the same column, so the two states do not shift
/// under each other.
struct FeedAskOfferRow: View {
    @Environment(\.argo) private var argo

    let offer: FeedAskOffer
    /// Whether this question takes more than one option, which is what draws the box.
    let isMultiple: Bool
    let isTicked: Bool
    let press: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: press) {
            HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
                if isMultiple {
                    FeedAskBox(isTicked: isTicked)
                }
                FeedMarker(text: offer.marker)
                    .foregroundStyle(number)
                words
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, ArgoSpacing.base)
            .padding(.horizontal, ArgoSpacing.comfortable)
            .background { ground }
            .overlay { shape.strokeBorder(edge, lineWidth: ArgoStroke.border) }
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .argoAnimation(.selection, value: isHovered)
        .accessibilityLabel(spoken)
        .accessibilityAddTraits(isTicked ? [.isSelected] : [])
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.stepBeforeProse) {
            Text(offer.label)
                .argoText(ArgoFeedRow.proseRung)
                .foregroundStyle(argo.color.text.primary)
                .fixedSize(horizontal: false, vertical: true)
            if let detail = offer.detail {
                Text(detail)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
    }

    /// The ground under a control on a surface which is not the deck — the role's own words. Hover
    /// lays a second layer over it rather than standing in for the pair with a third opacity.
    private var ground: some View {
        ZStack {
            shape.fill(argo.color.surface.control.color)
            if isHovered {
                shape.fill(argo.color.surface.hover.color)
            }
            if isTicked {
                shape.fill(argo.color.state.wash(argo.color.state.attention).color)
            }
        }
    }

    /// The two rungs below the `muted` the card itself wears, so a ticked option reads as marked
    /// against a ground that is already attention-coloured.
    private var edge: ArgoColor {
        if isTicked {
            return argo.color.state.rim(argo.color.state.attention)
        }
        return isHovered ? argo.color.edge.subtle : argo.color.edge.hairline
    }

    private var number: ArgoColor {
        isTicked ? argo.color.state.attention : argo.color.text.tertiary
    }

    /// Spoken with its number, because the number is how the answer names an option.
    private var spoken: String {
        let said = [offer.label, offer.detail].compactMap(\.self).joined(separator: ", ")
        return "\(offer.ordinal). \(said)"
    }
}

/// The box a many-of question ticks. A drawn square rather than a rung of the icon scale: no rung
/// is this size, and what it needs to be is a target to aim at rather than a symbol to recognise.
private struct FeedAskBox: View {
    @Environment(\.argo) private var argo

    let isTicked: Bool

    var body: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.marker)
            .fill(isTicked ? argo.color.state.attention : .transparent)
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.marker)
                    .strokeBorder(argo.color.edge.strong, lineWidth: ArgoStroke.border)
            }
            .overlay {
                if isTicked {
                    ArgoGlyph(ArgoSymbol.chosen, .inline)
                        .foregroundStyle(argo.color.text.onAccent)
                }
            }
            .frame(width: ArgoComposerVessel.askBoxSize, height: ArgoComposerVessel.askBoxSize)
    }
}
