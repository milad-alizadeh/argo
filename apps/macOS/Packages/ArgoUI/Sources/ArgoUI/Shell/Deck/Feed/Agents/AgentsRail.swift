import ArgoAtoms
import ArgoDesign
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
package struct AgentsRail: View {
    @Environment(\.argo) private var argo

    let agents: [FeedAgent]
    /// What the feed is scoped to, whether this rail is collapsed, and which chips have a reading
    /// behind them — all three the deck's state, which the rail writes. See `AgentsRailControl`.
    var control = AgentsRailControl.inert

    package var body: some View {
        if control.isCollapsed {
            AgentsRailStrip(agents: agents, control: control)
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
                MainChip(isSelected: control.scope.isSession, select: control.selectSession)
                ForEach(agents) { agent in
                    AgentChip(
                        agent: agent,
                        isSelected: control.scope.agent == agent.id,
                        scope: control.select(agent),
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(ArgoSpacing.comfortable)
        }
        .argoScrollsUnderCanopy()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(AgentsRailCopy.agents)
    }

    /// The ones that have landed stay in the count line's list because a Subagent that finished is
    /// how its spend is read at all. What the line SAYS is `AgentsRailCopy`.
    ///
    /// The line doubles as the way to collapse: a control of its own beside it would be a second
    /// thing at the top of a column whose whole job is to stay quiet.
    private var header: some View {
        Button { control.isCollapsed = true } label: {
            HStack(spacing: ArgoSpacing.snug) {
                Text(AgentsRailCopy.header(running: running))
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
        .accessibilityLabel(AgentsRailCopy.hide)
    }

    private var running: Int {
        FeedAgents.running(of: agents)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(agents: [FeedAgent], control: AgentsRailControl = AgentsRailControl.inert) {
        self.agents = agents
        self.control = control
    }
}
