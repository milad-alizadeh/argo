import SwiftUI

/// The offer to take a message away, drawn on the row itself (#767).
///
/// An OVERLAY, so a row is exactly as tall with the chip as without. The table measures rows
/// without it, and a control that changed a height would shift the reading under the pointer that
/// revealed it.
struct FeedProseCopy: ViewModifier {
    @Environment(\.argo) private var argo

    /// `nil` on every row that draws no chip — see `FeedRow.inPlaceOffer`.
    let offer: FeedRow.CopyOffer?
    /// Whether the row is lit for a reason of its own: the keyboard cursor is on it, or a still is
    /// being rendered of the state a pointer would produce.
    let isLit: Bool

    @State private var isPointerInside = false

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottomTrailing) { chip }
            // A row with no chip never writes the state, so moving the pointer down a run of calls
            // invalidates nothing.
            .onHover {
                if offer != nil {
                    isPointerInside = $0
                }
            }
            .argoAnimation(.stateChange, value: isShowing)
    }

    /// At the row's FOOT: a first line runs to the measure by definition and a last one rarely
    /// does, so this corner is usually the one the words leave empty.
    @ViewBuilder private var chip: some View {
        if let offer {
            ArgoCopyButton(
                text: offer.words,
                name: offer.label,
                size: .control,
                resting: argo.color.text.secondary,
            )
            .frame(width: ArgoFeedRow.copyChipSide, height: ArgoFeedRow.copyChipSide)
            .argoFloatingGlass(in: vessel)
            // The chip and not the frame around it: corners that draw nothing would take clicks
            // meant for the words behind them.
            .contentShape(vessel)
            .opacity(isShowing ? 1 : 0)
            // Hit testing follows the opacity, or an invisible chip answers clicks on the words.
            .allowsHitTesting(isShowing)
            // Clear of the keyboard cursor's ring, which is drawn on this corner too.
            .padding(ArgoSpacing.tight)
        }
    }

    private var vessel: RoundedRectangle {
        .rect(cornerRadius: ArgoRadius.control)
    }

    private var isShowing: Bool {
        offer != nil && (isLit || isPointerInside)
    }
}

extension View {
    /// Offers this row's words on the row, quiet until the reader is there — see `FeedProseCopy`.
    func argoFeedProseCopy(_ offer: FeedRow.CopyOffer?, isLit: Bool) -> some View {
        modifier(FeedProseCopy(offer: offer, isLit: isLit))
    }
}

#Preview("Feed prose copy — quiet, and lit") {
    let quiet = "At rest the words stand alone."
    let lit = "Lit, the offer floats in the corner the words leave empty."

    return VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        FeedProse(text: quiet, voice: .message)
            .argoFeedProseCopy(.init(words: quiet, label: "Copy Message"), isLit: false)
        FeedProse(text: lit, voice: .message)
            .argoFeedProseCopy(.init(words: lit, label: "Copy Message"), isLit: true)
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 620)
    .argoDeckSurface()
    .argoAppearance()
}
