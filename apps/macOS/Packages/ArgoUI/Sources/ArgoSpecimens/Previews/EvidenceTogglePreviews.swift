import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Evidence toggle — shut, open, and with nothing to show") {
    HStack(spacing: ArgoSpacing.comfortable) {
        EvidenceToggle(toggling: EvidenceToggling(feed: FeedProjection.previewRows, open: nil)) {}
        EvidenceToggle(
            toggling: EvidenceToggling(
                feed: FeedProjection.previewRows,
                open: FeedProjection.previewFailedCallID,
            ),
        ) {}
        EvidenceToggle(toggling: EvidenceToggling(feed: [], open: nil)) {}
    }
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
