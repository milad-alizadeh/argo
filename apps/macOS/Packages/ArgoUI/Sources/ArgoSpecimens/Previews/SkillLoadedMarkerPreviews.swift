import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Skill loaded — read, unreadable, and nothing behind it") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        ForEach(Array(FeedProjection.previewSkillLoads.enumerated()), id: \.offset) { _, skill in
            SkillLoadedMarker(skill: skill, isOpen: false, open: {})
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Skill loaded — the marker whose evidence is open") {
    VStack(alignment: .leading, spacing: ArgoFeedRow.gap) {
        let pair = Array(FeedProjection.previewSkillLoads.prefix(2).enumerated())
        ForEach(pair, id: \.offset) { position, skill in
            SkillLoadedMarker(skill: skill, isOpen: position == 0, open: {})
        }
    }
    .padding(ArgoFeedRow.inset)
    .frame(width: 720)
    .argoDeckSurface()
    .argoAppearance()
}
