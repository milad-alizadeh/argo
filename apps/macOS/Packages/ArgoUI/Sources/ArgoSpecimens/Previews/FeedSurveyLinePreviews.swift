import ArgoUI
import SwiftUI

#Preview("Survey line — the run of looking a turn opens with") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.callStep) {
        ForEach(FeedProjection.previewRows) { row in
            if case let .survey(survey) = row.content {
                FeedSurveyLine(survey: survey, isOpen: false, open: {})
            }
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
