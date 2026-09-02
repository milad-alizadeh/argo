import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Call lines — every kind the preview transcript makes") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallLine(call: call, isOpen: false, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Call lines — the one still running, under the ones that finished") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewPendingCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallLine(call: call, isOpen: false, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Call lines — the row whose evidence is open") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallLine(call: call, isOpen: call.ending.hasFailed, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
