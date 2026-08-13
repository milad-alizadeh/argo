import SwiftUI

/// The column a list marker is drawn in — a bullet, a number, the mark on a question's options.
///
/// Trailing-aligned in a fixed width, so `9.` and `10.` set their words on one vertical. Monospaced
/// digits, because a marker that re-measures per digit moves the words beside it.
struct FeedMarker: View {
    @Environment(\.argo) private var argo

    let text: String

    var body: some View {
        Text(text)
            .argoText(ArgoFeedRow.proseRung)
            .monospacedDigit()
            .foregroundStyle(argo.color.text.tertiary)
            .feedMarkerColumn()
    }
}

extension View {
    /// The marker column itself, for the marks that are not text — a question's glyph sits in the
    /// same column its options are numbered in. Here rather than at each call site so the width
    /// has ONE owner: two views spelling the same frame drift the moment one of them is retuned.
    func feedMarkerColumn() -> some View {
        frame(width: ArgoFeedRow.markerWidth, alignment: .trailing)
    }
}

#Preview("Feed marker — one vertical either side of ten") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(["9.", "10.", "•"], id: \.self) { mark in
            HStack(alignment: .firstTextBaseline, spacing: ArgoFeedRow.markerGap) {
                FeedMarker(text: mark)
                Text("the words it sets").argoText(ArgoFeedRow.proseRung)
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 320)
    .argoDeckSurface()
    .argoAppearance()
}
