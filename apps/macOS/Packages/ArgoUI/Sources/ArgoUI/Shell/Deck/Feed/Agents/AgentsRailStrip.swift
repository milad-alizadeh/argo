import SwiftUI

/// The rail collapsed: one state dot per Agent, and the chevron back.
///
/// Dots rather than nothing at all, because what the rail is glanced at to answer survives losing
/// the names — how many are working — and a rail that vanished would need a control floating over
/// the feed to bring it back.
struct AgentsRailStrip: View {
    @Environment(\.argo) private var argo

    let agents: [FeedAgent]
    let scope: FeedScope
    let expand: () -> Void
    /// Scoping the feed onto one Agent, answered for the ones there is a reading of — see
    /// `AgentChip.scope`. A dot with nothing behind it is drawn and does nothing.
    let select: (FeedAgent) -> (() -> Void)?

    var body: some View {
        VStack(spacing: ArgoSpacing.snug) {
            Button(action: expand) { ArgoDisclosure(.beside) }
                .buttonStyle(QuietButtonStyle())
                .accessibilityLabel("Show subagents")
            ForEach(agents) { dot($0) }
            Spacer(minLength: ArgoSpacing.flush)
        }
        .padding(.vertical, ArgoSpacing.base)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .argoScrollsUnderCanopy()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Subagents, collapsed")
    }

    /// The dot carries the whole row's meaning here, so its label says what the chip's name would.
    @ViewBuilder private func dot(_ agent: FeedAgent) -> some View {
        let indicator = SessionStateIndicator(state: agent.isRunning ? .running : .idle)
            .padding(ArgoSpacing.tight)
            .background(
                scope.agent == agent.id ? argo.color.surface.selected : .transparent,
                in: .rect(cornerRadius: ArgoRadius.marker),
            )

        if let select = select(agent) {
            Button(action: select) { indicator }
                .buttonStyle(.plain)
                .accessibilityLabel(agent.label)
                .accessibilityAddTraits(scope.agent == agent.id ? [.isSelected] : [])
        } else {
            indicator.accessibilityLabel(agent.label)
        }
    }
}

#Preview("Agents rail collapsed — a fan-out as dots") {
    AgentsRailStrip(
        agents: FeedAgents.all(in: FeedProjection.previewRows),
        scope: .session,
        expand: {},
        select: { _ in {} },
    )
    .frame(width: ArgoLayout.agentsRailCollapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agents rail collapsed — one Agent scoped onto") {
    AgentsRailStrip(
        agents: FeedAgents.all(in: FeedProjection.previewRows),
        scope: .subagent(0),
        expand: {},
        select: { _ in {} },
    )
    .frame(width: ArgoLayout.agentsRailCollapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
