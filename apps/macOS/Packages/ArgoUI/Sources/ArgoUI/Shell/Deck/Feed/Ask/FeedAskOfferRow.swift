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
    /// Whether the question is still open. A closed one draws its options as the reading they now
    /// are: no hover, and the ones nobody took step back (#1664).
    @Environment(\.isEnabled) private var isEnabled

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
            .feedAskCard(isHovered: showsHover, isTicked: isTicked, isReading: !isEnabled)
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .argoAnimation(.selection, value: showsHover)
        .accessibilityLabel(spoken)
        .accessibilityAddTraits(isTicked ? [.isSelected] : [])
    }

    /// `onHover` is not gated by `isEnabled`, so the pointer still crosses a closed question's
    /// cards and the ground would still light under it.
    private var showsHover: Bool {
        isHovered && isEnabled
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.stepBeforeProse) {
            Text(offer.label)
                .argoText(ArgoFeedRow.proseRung)
                .foregroundStyle(label)
                .fixedSize(horizontal: false, vertical: true)
            if let detail = offer.detail {
                Text(detail)
                    .argoLine(ArgoTypography.rowMeta, .metadata)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var number: ArgoColor {
        isTicked ? argo.color.state.attention : argo.color.text.tertiary
    }

    /// An option steps back only once the question is closed and another one was taken — the same
    /// rung, for the same reason, `FeedAskOptions` quiets an offer the answer passed over.
    private var label: ArgoColor {
        !isEnabled && !isTicked ? argo.color.text.secondary : argo.color.text.primary
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
