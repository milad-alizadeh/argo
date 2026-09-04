import ArgoUI
import SwiftUI

#Preview("Work card — the two stretches a dense Turn folds into") {
    WorkLines(isOpen: false)
}

// Open: the card lists what it folded, with the failed step in the failure ink.
#Preview("Work card — opened onto what it folded") {
    WorkLines(isOpen: true)
}

private struct WorkLines: View {
    let isOpen: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
            ForEach(FeedProjection.previewDenseTurnRows) { row in
                if case let .work(work) = row.content {
                    FeedFoldLine(fold: work, opening: FeedFoldOpening(isOpen: isOpen, open: {}))
                }
            }
        }
        .padding(ArgoFeedRow.inset)
        .frame(width: 720)
        .argoDeckSurface()
        .argoAppearance()
    }
}
