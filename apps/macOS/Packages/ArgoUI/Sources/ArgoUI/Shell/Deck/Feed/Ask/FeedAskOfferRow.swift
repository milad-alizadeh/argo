import ArgoAtoms
import ArgoDesign
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
            .feedAskCard(isHovered: isHovered, isTicked: isTicked)
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
