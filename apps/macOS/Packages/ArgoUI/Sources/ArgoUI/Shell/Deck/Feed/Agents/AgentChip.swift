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

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            SessionStateIndicator(state: agent.isRunning ? .running : .idle)
            VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                Text(agent.label)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                    .lineLimit(2)
                spend
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, ArgoSpacing.tight)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(spoken)
    }

    @ViewBuilder private var spend: some View {
        if let spend = agent.spend {
            Text(FeedSpend.words(spend))
                .argoText(ArgoTypography.machineCaption)
                .monospacedDigit()
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
        }
    }

    private var spoken: String {
        [agent.label, agent.isRunning ? "running" : "finished", agent.spend.map(FeedSpend.words)]
            .compactMap(\.self)
            .joined(separator: ", ")
    }
}

#Preview("Agent chips — running, and landed with what it spent") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(FeedAgents.all(in: FeedProjection.previewRows)) { AgentChip(agent: $0) }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoLayout.agentsRailWidth)
    .argoDeckSurface()
    .argoAppearance()
}
