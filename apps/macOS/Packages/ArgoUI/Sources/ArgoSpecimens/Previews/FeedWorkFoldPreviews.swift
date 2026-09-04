import ArgoUI
import SwiftUI

#Preview("Work card — the two stretches a dense Turn folds into") {
    WorkLines(isExpanded: false)
}

// Open: the card lists what it folded, with the failed step in the failure ink.
#Preview("Work card — opened onto what it folded") {
    WorkLines(isExpanded: true)
}

private struct WorkLines: View {
    let isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
            ForEach(FeedProjection.previewDenseTurnRows) { row in
                if case let .work(work) = row.content {
                    FeedFoldLine(
                        fold: work,
                        opening: FeedFoldOpening(isExpanded: isExpanded, expand: {}),
                    )
                }
            }
        }
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
    }
}
