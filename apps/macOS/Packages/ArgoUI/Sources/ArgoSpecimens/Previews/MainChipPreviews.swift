import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Main chip — the head of the rail, and the chip under it") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        MainChip(isSelected: true, select: {})
        ForEach(FeedAgents.all(in: FeedProjection.previewRows, of: .running)) {
            AgentChip(agent: $0)
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Main chip — unlit, the feed scoped onto an Agent instead") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        MainChip(isSelected: false, select: {})
        ForEach(FeedAgents.all(in: FeedProjection.previewRows, of: .running)) { agent in
            AgentChip(agent: agent, isSelected: agent.id == 1, scope: {})
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}
