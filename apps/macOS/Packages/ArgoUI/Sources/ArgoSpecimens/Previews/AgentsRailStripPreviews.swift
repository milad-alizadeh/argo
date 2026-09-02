import ArgoUI
import SwiftUI

#Preview("Agents rail collapsed — a fan-out as dots, under the Session's own reading") {
    @Previewable @State var scope = FeedScope.session
    @Previewable @State var isCollapsed = true

    AgentsRailStrip(
        agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running),
        control: AgentsRailControl(
            scope: $scope,
            isCollapsed: $isCollapsed,
            readings: AgentsRailFixture.readings,
        ),
    )
    .frame(width: ArgoAgentsRail.collapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agents rail collapsed — one Agent scoped onto, and the mark back") {
    @Previewable @State var scope = FeedScope.subagent(2)
    @Previewable @State var isCollapsed = true

    AgentsRailStrip(
        agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running),
        control: AgentsRailControl(
            scope: $scope,
            isCollapsed: $isCollapsed,
            readings: AgentsRailFixture.readings,
        ),
    )
    .frame(width: ArgoAgentsRail.collapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
