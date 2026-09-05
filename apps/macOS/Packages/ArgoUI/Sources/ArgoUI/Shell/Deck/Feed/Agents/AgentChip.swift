import ArgoDesign
import SwiftUI

/// One subagent: a dot for whether it is still working, what it was handed, and what it cost.
///
/// The spend is LABELLED. A bare `143.6K` beside a name is a number nobody can name — tokens,
/// dollars, lines — and the row it sits in is exactly where a reader has least context to guess
/// from. It appears only once the subagent has reported — with the delegating call's result, and
/// never at all for a backgrounded Agent (#908) — because a chip showing `0` would claim the work
/// was free rather than unpriced.
package struct AgentChip: View {
    @Environment(\.argo) private var argo

    let agent: FeedAgent
    /// Whether the feed is scoped onto this Agent. The row is drawn by its GROUND alone — no
    /// leading accent rule, which the study settled: a brand edge beside a wash re-states selection
    /// a second time, and macOS selection is the wash.
    var isSelected = false
    /// Scoping the feed onto this Agent, or `nil` where Argo has no reading of it to scope onto.
    /// Absent is the ordinary case for a running Agent, and it degrades down: the chip still says
    /// what is happening and simply does not claim to be a control.
    var scope: (() -> Void)?
    /// Stop waiting for this Agent's report (#1267), or `nil` where there is nothing to end — see
    /// `AgentsRailControl.end(_:)`, which owns which chips those are.
    var end: (() -> Void)?

    package var body: some View {
        chip
            // A context menu and not a control on the line: a fan-out is thirty of these, and a
            // button per chip would put thirty of them in a column whose whole job is to stay
            // quiet (D33). The same pair `SessionRow` uses, for the same reason.
            .contextMenu { endAction }
            // A menu takes a pointer. This is the way in that does not.
            .accessibilityActions { endAction }
    }

    @ViewBuilder private var chip: some View {
        if let scope {
            Button(action: scope) { line }
                .buttonStyle(FeedRowButtonStyle(isOpen: isSelected))
                .accessibilityLabel(spoken)
                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        } else {
            line
                .accessibilityElement(children: .combine)
                .accessibilityLabel(spoken)
        }
    }

    /// Nothing at all where there is nothing to end, rather than a disabled entry: an empty menu
    /// does not open, which is the honest answer for a chip whose delegation the record can still
    /// close by itself.
    @ViewBuilder private var endAction: some View {
        if let end {
            Button(AgentsRailCopy.end, action: end)
                .help(AgentsRailCopy.endHelp)
        }
    }

    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            SessionStateIndicator(state: agent.activity.dot)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(agent.label)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                    .lineLimit(2)
                AgentMeter(agent: agent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, ArgoSpacing.tight)
    }

    private var spoken: String {
        [
            agent.label,
            AgentsRailCopy.state(agent.activity),
            agent.durationMs.map { TurnClockPhrase.spoken(seconds: $0 / 1000) },
            agent.spend.map(FeedSpend.agentWords),
            scope == nil ? "nothing read" : nil,
        ]
        .compactMap(\.self)
        .joined(separator: ", ")
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        agent: FeedAgent,
        isSelected: Bool = false,
        scope: (() -> Void)? = nil,
        end: (() -> Void)? = nil,
    ) {
        self.agent = agent
        self.isSelected = isSelected
        self.scope = scope
        self.end = end
    }
}
