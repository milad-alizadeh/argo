import SwiftUI

/// Who else is working, beside the reading of what you are working on.
///
/// A list of chips rather than cards, because it has to hold thirty of them: a fan-out is the state
/// this rail exists for, and a grid of cards dies at that width. Flat and subordinate (D33) — the
/// feed is the reading surface and this is navigation, so selecting an Agent re-scopes that feed
/// rather than opening a second one.
///
/// When the rail appears at all is still the deck's decision, made from the same reading these came
/// from.
struct AgentsRail: View {
    @Environment(\.argo) private var argo

    let agents: [FeedAgent]
    /// What the feed is scoped to, whether this rail is collapsed, and which chips have a reading
    /// behind them — all three the deck's state, which the rail writes. See `AgentsRailControl`.
    var control = AgentsRailControl.inert

    var body: some View {
        if control.isCollapsed {
            AgentsRailStrip(
                agents: agents,
                scope: control.scope,
                expand: { control.isCollapsed = false },
                select: select(_:),
            )
        } else {
            full
        }
    }

    /// The count line rides INSIDE the scroll, above the chips, rather than pinned over them.
    /// Anything pinned below the canopy would hide this column's content from the glass, and a bar
    /// with nothing behind it is a bar with no material to show.
    private var full: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                header
                ForEach(agents) { agent in
                    AgentChip(
                        agent: agent,
                        isSelected: control.scope.agent == agent.id,
                        scope: select(agent),
                    )
                }
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
    ///
    /// The line doubles as the way to collapse: a control of its own beside it would be a second
    /// thing at the top of a column whose whole job is to stay quiet.
    private var header: some View {
        Button { control.isCollapsed = true } label: {
            HStack(spacing: ArgoSpacing.snug) {
                Text("Subagents · \(running) running")
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                Spacer(minLength: ArgoSpacing.flush)
                ArgoDisclosure(.beside)
                    .rotationEffect(.degrees(180))
            }
        }
        // `.plain`, never `QuietButtonStyle`: that style draws a filled control ground, which is a
        // CARD at the top of a rail the contract keeps flat (D33) — and at `surface.overlay` it
        // outweighs the selected chip's own wash, so the heading would beat the selection for the
        // eye. It also overrides the type ramp, which is what makes this line quiet.
        .buttonStyle(.plain)
        .accessibilityLabel("Hide subagents")
    }

    private var running: Int {
        agents.filter(\.isRunning).count
    }

    /// What selecting one chip does, or `nil` where there is no reading to scope onto.
    ///
    /// Selecting the chip that is already lit scopes back to the Session — the rail is how a reader
    /// gets out of a Subagent as well as into one, so the way back is never a control they have to
    /// find somewhere else.
    private func select(_ agent: FeedAgent) -> (() -> Void)? {
        guard control.readings.rows(of: agent) != nil else { return nil }
        return {
            control.scope = control.scope.agent == agent.id ? .session : .subagent(agent.id)
        }
    }
}

#Preview("Agents rail — a fan-out with two still working") {
    @Previewable @State var scope = FeedScope.session
    @Previewable @State var isCollapsed = false

    AgentsRail(
        agents: FeedAgents.all(in: FeedProjection.previewRows),
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
        agents: Array(FeedAgents.all(in: FeedProjection.previewRows).prefix(1)),
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
        agents: FeedAgents.all(in: FeedProjection.previewRows),
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
        agents: FeedAgents.all(in: FeedProjection.previewRows),
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
