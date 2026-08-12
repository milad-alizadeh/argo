import SwiftUI

/// The hairline where two zones meet, taking its orientation from the stack it sits in. It
/// separates without enclosing either side — no border, no shadow, no rounded container — which
/// is what keeps the deck one plane rather than a stack of cards (D40).
struct DeckSeparator: View {
    @Environment(\.argo) private var argo

    /// The divider is HIDDEN and drawn over, not tinted: it keeps the platform's thickness and its
    /// orientation from the stack, but a translucent ink over its own grey composites brighter than
    /// `edge.hairline`.
    var body: some View {
        Divider()
            .hidden()
            .overlay(argo.color.edge.hairline)
    }
}

#Preview("Deck separator") {
    VStack(spacing: ArgoSpacing.flush) {
        Color.clear
        DeckSeparator()
        Color.clear
    }
    .frame(width: 320, height: 120)
    .argoDeckSurface()
    .argoAppearance()
}
