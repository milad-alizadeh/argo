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
            .frame(width: ArgoFeedRow.markerWidth, alignment: .trailing)
    }
}
