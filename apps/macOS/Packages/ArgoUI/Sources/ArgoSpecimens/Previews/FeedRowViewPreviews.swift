import ArgoUI
import SwiftUI

#Preview("Feed rows — every kind, at rest") {
    FeedPreview(rows: FeedProjection.previewRows)
        .frame(width: 820, height: 620)
}

#Preview("Feed rows — the row whose evidence is open") {
    FeedPreview(rows: FeedProjection.previewCallRows, open: FeedProjection.previewFailedCallID)
        .frame(width: 820, height: 620)
}
