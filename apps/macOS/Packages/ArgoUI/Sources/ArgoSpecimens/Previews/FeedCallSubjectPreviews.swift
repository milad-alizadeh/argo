import ArgoUI
import SwiftUI

#Preview("Call subject — every shape a call can name") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewCallRows) { row in
            if case let .call(call) = row.content {
                FeedCallSubject(subject: call.subject)
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 520)
    .argoDeckSurface()
    .argoAppearance()
}
