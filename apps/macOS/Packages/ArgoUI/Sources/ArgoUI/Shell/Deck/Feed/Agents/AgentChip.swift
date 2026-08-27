import SwiftUI

/// One subagent: a dot for whether it is still working, what it was handed, and what it cost.
///
/// The spend is LABELLED. A bare `143.6K` beside a name is a number nobody can name — tokens,
/// dollars, lines — and the row it sits in is exactly where a reader has least context to guess
/// from. It appears only once the subagent has reported: nothing is reported until the delegating
/// call comes back, and a running chip showing `0` would claim a busy agent had spent nothing.
struct AgentChip: View {
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

    var body: some View {
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

    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            SessionStateIndicator(state: agent.isRunning ? .running : .idle)
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
            agent.isRunning ? "running" : "finished",
            agent.durationMs.map { TurnClockPhrase.spoken(seconds: $0 / 1000) },
            agent.spend.map(FeedSpend.words),
            scope == nil ? "nothing read" : nil,
        ]
        .compactMap(\.self)
        .joined(separator: ", ")
    }
}

#Preview("Agent chips — running, and landed with what it spent") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(FeedAgents.all(in: FeedProjection.previewRows)) { AgentChip(agent: $0) }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Agent chips — the selected one, against the ones beside it") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(FeedAgents.all(in: FeedProjection.previewRows)) { agent in
            AgentChip(agent: agent, isSelected: agent.id == 1, scope: {})
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}
