import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Agent chips — running, and landed with what it spent") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(FeedAgents.all(in: FeedProjection.previewRows, of: .running)) {
            AgentChip(agent: $0)
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agent chips — the selected one, against the ones beside it") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(FeedAgents.all(in: FeedProjection.previewRows, of: .running)) { agent in
            AgentChip(agent: agent, isSelected: agent.id == 1, scope: {})
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}
