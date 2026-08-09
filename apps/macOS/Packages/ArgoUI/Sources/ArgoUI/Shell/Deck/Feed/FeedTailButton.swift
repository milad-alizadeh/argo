import SwiftUI

/// The way back to the newest line, from wherever the reader scrolled to.
///
/// It is on screen only while the feed has stopped following — a control offering to take you where
/// you already are is a control that says nothing. Floated over the reading rather than docked
/// beside it, because it belongs to a state the feed is in and not to the deck's furniture; on the
/// trailing edge, so it never lands under the plan pill floating over the same edge.
///
/// A circle of glass carrying a down arrow and nothing else — the material `ArgoFloatingGlass`
/// spells, because this is a state the reading is in rather than a zone of the deck.
///
/// The word left the face with the capsule. A down arrow in the bottom corner of a scroll is the
/// one gesture the platform already spells this way, so the label it used to print is now carried
/// where it costs no space: the control still ANNOUNCES itself as "Newest", unchanged, and the
/// hint still says what pressing it does.
struct FeedTailButton: View {
    @Environment(\.argo) private var argo

    let follow: () -> Void

    var body: some View {
        Button(action: follow) {
            ArgoGlyph(ArgoSymbol.latest, .control)
                .foregroundStyle(argo.color.text.secondary)
                .frame(width: ArgoFeedRow.tailDiameter, height: ArgoFeedRow.tailDiameter)
                .argoFloatingGlass(in: .circle)
                // The circle and not the square around it: the corners of a frame that draws
                // nothing would take clicks meant for the reading behind them.
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Newest")
        .accessibilityHint("Scrolls back to the newest line and follows the Session again")
    }
}

#Preview("Feed tail — the way back to the newest line") {
    FeedTailButton(follow: {})
        .padding(ArgoFeedRow.inset)
        .frame(width: 720, height: 120, alignment: .bottomTrailing)
        .argoDeckSurface()
        .argoAppearance()
}
