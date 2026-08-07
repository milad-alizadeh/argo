import SwiftUI

/// The hairline where two zones meet, taking its orientation from the stack it sits in.
///
/// A seam, never a border: it marks a boundary between two regions of one plane rather than
/// enclosing either of them, which is what keeps the deck a single machined surface instead of
/// a stack of cards (D40).
struct DeckSeam: View {
    @Environment(\.argo) private var argo

    var body: some View {
        Divider().overlay(argo.color.edge.hairline)
    }
}

#Preview("Deck seam") {
    VStack(spacing: ArgoSpacing.flush) {
        Color.clear
        DeckSeam()
        Color.clear
    }
    .frame(width: 320, height: 120)
    .argoDeckSurface()
    .argoAppearance()
}
