import SwiftUI

/// The way back to the newest line, from wherever the reader scrolled to.
///
/// It is on screen only while the feed has stopped following — a control offering to take you where
/// you already are is a control that says nothing. Floated over the reading rather than docked
/// beside it, because it belongs to a state the feed is in and not to the deck's furniture; on the
/// trailing edge, so it never lands under the plan pill floating over the same edge.
///
/// It says so in words as well as in a mark. A bare arrow in a corner is a gesture the reader has
/// to guess at, and the one thing this control has to be is obvious to somebody who has lost their
/// place.
struct FeedTailButton: View {
    @Environment(\.argo) private var argo

    let follow: () -> Void

    var body: some View {
        Button(action: follow) {
            HStack(spacing: ArgoSpacing.tight) {
                ArgoGlyph(ArgoSymbol.latest, .inline)
                Text("Newest")
                    .argoText(ArgoTypography.caption)
            }
            .foregroundStyle(argo.color.text.secondary)
            .padding(.horizontal, ArgoSpacing.base)
            .padding(.vertical, ArgoSpacing.tight)
            .background(argo.color.surface.overlay, in: .capsule)
            .overlay {
                Capsule().strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
            }
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
