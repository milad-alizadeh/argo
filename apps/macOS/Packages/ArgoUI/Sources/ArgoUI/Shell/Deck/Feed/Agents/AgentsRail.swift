import SwiftUI

/// Who else is working, beside the reading of what you are working on.
///
/// A list of chips rather than cards, because it has to hold thirty of them: a fan-out is the state
/// this rail exists for, and a grid of cards dies at that width. It takes agents and nothing else —
/// when the rail appears at all is the deck's decision, made from the same reading these came from.
struct AgentsRail: View {
    @Environment(\.argo) private var argo

    let agents: [FeedAgent]

    /// The count line rides INSIDE the scroll, above the chips, rather than pinned over them.
    /// Anything pinned below the canopy would hide this column's content from the glass, and a bar
    /// with nothing behind it is a bar with no material to show.
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                header
                ForEach(agents) { AgentChip(agent: $0) }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(ArgoSpacing.comfortable)
        }
        .argoScrollsUnderCanopy()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Subagents")
    }

    /// The count is of what is RUNNING, which is the question the rail is being glanced at to
    /// answer. The ones that have landed stay in the list because a subagent that finished is how
    /// its spend is read at all.
    private var header: some View {
        Text("Subagents · \(running) running")
            .argoText(ArgoTypography.sectionLabel)
            .foregroundStyle(argo.color.text.tertiary)
            .lineLimit(1)
    }

    private var running: Int {
        agents.filter(\.isRunning).count
    }
}

#Preview("Agents rail — a fan-out with two still working") {
    AgentsRail(agents: FeedAgents.all(in: FeedProjection.previewRows))
        .frame(width: ArgoLayout.agentsRailWidth, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Agents rail — one subagent, still working") {
    AgentsRail(agents: Array(FeedAgents.all(in: FeedProjection.previewRows).prefix(1)))
        .frame(width: ArgoLayout.agentsRailWidth, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}
