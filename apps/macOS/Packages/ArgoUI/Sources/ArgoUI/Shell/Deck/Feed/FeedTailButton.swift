import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The way back to the newest line, from wherever the reader scrolled to.
///
/// On screen only while the feed has stopped following, floated over the reading on the trailing
/// edge — so it never lands under the plan pill floating over the same edge.
///
/// The face carries no word: the label lives in the announcement ("Newest") and the hint. What the
/// circle carries instead is HOW MUCH went past while the reader was reading.
struct FeedTailButton: View {
    @Environment(\.argo) private var argo

    /// How much the agent said since the reader left the end — see `FeedTail.newMessages`.
    var newMessages = 0
    let follow: () -> Void

    var body: some View {
        // The one icon button in the app that does NOT take `ArgoControlBox.icon`, and the reason
        // is beside `tailDiameter`: this control's box answers to the plan pill's lane rather than
        // to the button, because the two float over the same edge and a mark narrower than the lane
        // would sit inside a float rather than beside one.
        ArgoIconButton(
            ArgoSymbol.latest,
            voice: ArgoControlVoice("Newest"),
            face: ArgoControlFace(
                box: ArgoFeedRow.tailDiameter,
                ink: argo.color.text.secondary,
                ground: .floatingGlass,
            ),
            act: follow,
        )
        .overlay(alignment: .topTrailing) { badge }
        .accessibilityValue(spoken)
        .accessibilityHint("Scrolls back to the newest line and follows the Session again")
    }

    /// The count, half off the corner of the circle so it never sits on the glyph. Nothing at all
    /// at zero.
    @ViewBuilder private var badge: some View {
        if newMessages > 0 {
            ArgoBadge(count: newMessages)
                .offset(x: ArgoBadge.height / 2, y: -ArgoBadge.height / 2)
                // Hidden from the reader who is TOLD the number: the control speaks it as its own
                // value, and a badge that stayed in the tree would announce it a second time.
                .accessibilityHidden(true)
        }
    }

    /// What the control is worth, spoken — silent at zero. A VALUE on the control and never a live
    /// region: a count that announced itself as it climbed would talk over the feed it counts.
    private var spoken: String {
        switch newMessages {
        case 0: ""
        case 1: "1 new message"
        default: "\(newMessages) new messages"
        }
    }
}

#Preview("Feed tail — the way back to the newest line") {
    FeedTailButton(follow: {})
        .padding(ArgoFeedRow.inset)
        .frame(width: 720, height: 120, alignment: .bottomTrailing)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Feed tail — carrying what was said since the reader left") {
    FeedTailButton(newMessages: 3, follow: {})
        .padding(ArgoFeedRow.inset)
        .frame(width: 720, height: 120, alignment: .bottomTrailing)
        .argoDeckSurface()
        .argoAppearance()
}
