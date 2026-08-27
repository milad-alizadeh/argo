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

    /// A ScrollView, exactly as the expanded rail is: thirty dots outgrow the column too, and
    /// `argoScrollsUnderCanopy` insets SCROLL content — on a plain stack it is a no-op, so the
    /// first dots end up drawn behind the glass.
    var body: some View {
        ScrollView {
            LazyVStack(spacing: ArgoSpacing.snug) {
                // `.plain` for the reason the rail's own heading takes it: a filled control ground
                // here would be a card in a column 28 points wide.
                Button(action: expand) { ArgoDisclosure(.beside) }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Show subagents")
                ForEach(agents) { dot($0) }
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(.vertical, ArgoSpacing.base)
        }
        .argoScrollsUnderCanopy()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
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
    .frame(width: ArgoAgentsRail.collapsedWidth, height: 420)
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
    .frame(width: ArgoAgentsRail.collapsedWidth, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}
