import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Ask — waiting on you, and the same feed's question once it is settled") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewAsks.enumerated()), id: \.offset) { _, ask in
            FeedAskLine(ask: ask)
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Ask — every waiting shape") {
    ScrollView {
        VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
            ForEach(Array(FeedProjection.previewWaitingAsks.enumerated()), id: \.offset) { _, ask in
                FeedAskLine(ask: ask)
            }
        }
        .padding(ArgoFeedRow.inset)
    }
    .frame(width: 720, height: 760)
    .argoDeckSurface()
    .argoAppearance()
}
