import ArgoUI
import SwiftUI

#Preview("Agents rail — a fan-out with two still working") {
    @Previewable @State var scope = FeedScope.session
    @Previewable @State var isCollapsed = false

    AgentsRail(
        agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running),
        control: AgentsRailControl(
            scope: $scope,
            isCollapsed: $isCollapsed,
            readings: AgentsRailFixture.readings,
        ),
    )
    .frame(width: ArgoAgentsRail.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agents rail — one subagent, still working") {
    @Previewable @State var scope = FeedScope.session
    @Previewable @State var isCollapsed = false

    AgentsRail(
        agents: Array(FeedAgents.all(in: FeedProjection.previewRows, of: .running).prefix(1)),
        control: AgentsRailControl(scope: $scope, isCollapsed: $isCollapsed),
    )
    .frame(width: ArgoAgentsRail.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agents rail — one Agent scoped onto, with the rest beside it") {
    // Index 2 is the preview transcript's one ANSWERED delegation, and so the one chip with a
    // reading behind it — see `AgentsRailFixture`.
    @Previewable @State var scope = FeedScope.subagent(2)
    @Previewable @State var isCollapsed = false

    AgentsRail(
        agents: FeedAgents.all(in: FeedProjection.previewRows, of: .running),
        control: AgentsRailControl(
            scope: $scope,
            isCollapsed: $isCollapsed,
            readings: AgentsRailFixture.readings,
        ),
    )
    .frame(width: ArgoAgentsRail.width, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agents rail — collapsed to its dot strip") {
    @Previewable @State var scope = FeedScope.session
    @Previewable @State var isCollapsed = true

    AgentsRail(
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
