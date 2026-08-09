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
///
/// What the circle now carries is HOW MUCH went past while the reader was reading. Without it the
/// control is the same whether one line arrived or forty, and the only way to find out costs them
/// the place they scrolled to in order to read something.
struct FeedTailButton: View {
    @Environment(\.argo) private var argo

    /// How much the agent said since the reader left the end — see `FeedTail.newMessages`.
    var newMessages = 0
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
                .overlay(alignment: .topTrailing) { badge }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Newest")
        .accessibilityValue(spoken)
        .accessibilityHint("Scrolls back to the newest line and follows the Session again")
    }

    /// The count, on the corner of the circle. Nothing at all at zero: a bare control already says
    /// the reading is detached, and a `0` would be the badge claiming the agent said nothing when
    /// what it has to report is that nothing was said.
    ///
    /// Half off the circle's edge rather than inside it. The glyph is what the control IS, and a
    /// chip pulled in over it would sit on the mark a reader is looking for — the trailing gutter
    /// the control floats in is what leaves room to hang it over the boundary instead.
    @ViewBuilder private var badge: some View {
        if newMessages > 0 {
            ArgoBadge(count: newMessages)
                .offset(x: ArgoBadge.height / 2, y: -ArgoBadge.height / 2)
                // Hidden from the reader who is TOLD the number: the control speaks it as its own
                // value, and a badge that stayed in the tree would announce it a second time.
                .accessibilityHidden(true)
        }
    }

    /// What the control is worth, spoken. Silent at zero rather than "0 new messages", for the same
    /// reason nothing is drawn: there is no news to give.
    ///
    /// Spoken as a VALUE on the control and never as a live region. A count that announced itself
    /// as it climbed would talk over the feed it is counting — and a reader who has scrolled up is
    /// reading, which is exactly the moment not to interrupt.
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
