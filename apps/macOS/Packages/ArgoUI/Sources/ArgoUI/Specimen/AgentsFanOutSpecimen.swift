import SwiftUI

/// The rail carrying a fan-out it cannot fit, under the canopy, held at the END of its own scroll.
///
/// The rail is its OWN scroller: it does not move with the feed, and it only scrolls when its chips
/// outgrow its column. So this is the one state in which anything of the rail's passes beneath the
/// glass, and a screenshot cannot scroll — hence the anchor.
struct AgentsFanOutSpecimen: View {
    var body: some View {
        ZStack(alignment: .top) {
            DeckCanopy(header: SessionHeaderFixture.header(for: .managed))
                .zIndex(1)
            AgentsRail(agents: AgentsFanOutFixture.agents)
                .frame(width: ArgoLayout.agentsRailWidth)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .defaultScrollAnchor(.bottom)
        .environment(\.argoDeckCanopy, ArgoLayout.deckCanopyHeight)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .argoDeckSurface()
    }
}

#Preview("Agents rail — a fan-out running under the canopy") {
    AgentsFanOutSpecimen()
        .frame(width: 900, height: 620)
        .argoAppearance()
}
