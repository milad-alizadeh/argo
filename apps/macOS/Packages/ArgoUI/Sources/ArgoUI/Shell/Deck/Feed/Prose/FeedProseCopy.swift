import SwiftUI

/// The offer to take a Turn's messages away, drawn under the last of them and flush with its first
/// letter (#767).
///
/// A row that draws one is that much taller for it, lit or not: the table measures rows once, and a
/// control that took height when the pointer arrived would shift the reading under that pointer.
struct FeedProseCopy: ViewModifier {
    @Environment(\.argo) private var argo

    /// `nil` on every row that draws no chip — one Turn draws one, and `FeedCopy.chipOffer` is
    /// where the rule is.
    let offer: FeedRow.CopyOffer?
    /// Whether the row is lit for a reason of its own: the keyboard cursor is on it, or a still is
    /// being rendered of the state a pointer would produce.
    let isLit: Bool

    @State private var isPointerInside = false

    func body(content: Content) -> some View {
        // The chip carries the step rather than the stack: an absent chip is still a child, and a
        // stack's spacing would open the gap under every row that draws none.
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            content
            chip
        }
        // A row with no chip never writes the state, so moving the pointer down a run of calls
        // invalidates nothing.
        .onHover {
            if offer != nil {
                isPointerInside = $0
            }
        }
        .argoAnimation(.stateChange, value: isShowing)
    }

    @ViewBuilder private var chip: some View {
        if let offer {
            ArgoCopyButton(
                text: offer.words,
                name: offer.label,
                size: .control,
                resting: argo.color.text.secondary,
            )
            .frame(width: ArgoFeedRow.copyChipSide, height: ArgoFeedRow.copyChipSide)
            // The chip and not the frame around it: corners that draw nothing would take clicks
            // meant for the words beside them.
            .contentShape(RoundedRectangle(cornerRadius: ArgoRadius.control))
            .opacity(isShowing ? 1 : 0)
            // Hit testing follows the opacity, or an invisible chip answers clicks under the words.
            .allowsHitTesting(isShowing)
            .padding(.top, ArgoFeedRow.copyChipStep)
        }
    }

    private var isShowing: Bool {
        offer != nil && (isLit || isPointerInside)
    }
}

extension View {
    /// Offers a Turn's messages under the last of them, quiet until the reader is there.
    func argoFeedProseCopy(_ offer: FeedRow.CopyOffer?, isLit: Bool) -> some View {
        modifier(FeedProseCopy(offer: offer, isLit: isLit))
    }
}

#Preview("Feed prose copy — quiet, and lit") {
    let quiet = "At rest the words stand alone."
    let lit = "Lit, the offer stands under them, flush with the first letter."

    return VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        FeedProse(text: quiet, voice: .message)
            .argoFeedProseCopy(.init(words: quiet, label: "Copy Messages"), isLit: false)
        FeedProse(text: lit, voice: .message)
            .argoFeedProseCopy(.init(words: lit, label: "Copy Messages"), isLit: true)
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 620)
    .argoDeckSurface()
    .argoAppearance()
}
