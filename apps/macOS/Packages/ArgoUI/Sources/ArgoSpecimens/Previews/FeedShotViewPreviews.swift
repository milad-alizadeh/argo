import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Shot — the four provenances, side by side") {
    HStack(alignment: .top, spacing: ArgoFeedRow.shotGap) {
        ForEach(Array(FeedProjection.previewShots.enumerated()), id: \.offset) { _, shot in
            FeedShotView(shot: shot, open: { _ in })
        }
    }
    .padding(ArgoFeedRow.inset)
    .argoDeckSurface()
    .argoAppearance()
}
