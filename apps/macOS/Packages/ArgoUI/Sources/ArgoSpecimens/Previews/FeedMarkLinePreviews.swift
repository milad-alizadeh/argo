import ArgoUI
import SwiftUI

#Preview("Marks — every one the preview transcript punctuates its reading with") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewMarks.enumerated()), id: \.offset) { _, mark in
            FeedMarkLine(mark: mark)
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Marks — a Permission the gate refused because nobody answered") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        FeedMarkLine(mark: .turnEnded(.endTurn))
        FeedMarkLine(mark: .permissionExpired(FeedProjection.previewExpiry))
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
