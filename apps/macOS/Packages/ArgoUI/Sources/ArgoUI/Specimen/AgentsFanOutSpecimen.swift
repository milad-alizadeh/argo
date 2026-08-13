import SwiftUI

/// The rail carrying a fan-out it cannot fit, under the canopy, held at the END of its own scroll.
///
/// The rail is its OWN scroller: it does not move with the feed, and it only scrolls when its chips
/// outgrow its column. So this is the one state in which anything of the rail's passes beneath the
/// glass, and a screenshot cannot scroll — hence the anchor.
struct AgentsFanOutSpecimen: View {
    /// The same twenty Agents as a strip of dots. Collapsed is where a wide fan-out reads BEST —
    /// twenty dots fit a column that twenty names overflow — so it is the case worth a still of its
    /// own rather than a variant nobody looks at.
    var isCollapsed = false

    @State private var scope = FeedScope.session

    var body: some View {
        ZStack(alignment: .top) {
            DeckCanopy(header: SessionHeaderFixture.header(for: .managed))
                .zIndex(1)
            AgentsRail(
                agents: AgentsFanOutFixture.agents,
                control: AgentsRailControl(
                    scope: $scope,
                    isCollapsed: .constant(isCollapsed),
                    readings: AgentsRailFixture.fanOutReadings,
                ),
            )
            .frame(width: width)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .defaultScrollAnchor(.bottom)
        .environment(\.argoDeckCanopy, ArgoLayout.deckCanopyHeight)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
    }

    private var width: CGFloat {
        isCollapsed ? ArgoLayout.agentsRailCollapsedWidth : ArgoLayout.agentsRailWidth
    }
}

#Preview("Agents rail — a fan-out running under the canopy") {
    AgentsFanOutSpecimen()
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Agents rail — the same fan-out collapsed to dots") {
    AgentsFanOutSpecimen(isCollapsed: true)
        .frame(width: 900, height: 620)
        .argoAppearance()
}
