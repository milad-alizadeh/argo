import ArgoDesign
import SwiftUI

/// The Session's own reading, at the head of the rail.
///
/// A chip like the Agents under it — not a card and not a back button (D33, #1013). The rail is
/// then the list of readings this Session has with the root one first, and the way out of a
/// Subagent is the same gesture as the way in rather than a control a reader has to be told about.
struct MainChip: View {
    @Environment(\.argo) private var argo

    let isSelected: Bool
    let select: () -> Void

    var body: some View {
        Button(action: select) { line }
            .buttonStyle(FeedRowButtonStyle(isOpen: isSelected))
            .accessibilityLabel(AgentsRailCopy.main)
            .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    /// The leading slot is the Agents' state-dot slot kept EMPTY, so the names line up and this row
    /// still makes no claim: the root Agent's state is the Session's own, which this rail is not
    /// told. The collapsed strip draws a mark there instead, because that is the only form where
    /// the word `Main` is not on screen to say which row this is.
    private var line: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            Spacer()
                .frame(width: ArgoIconSize.statusDot)
            Text(AgentsRailCopy.main)
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, ArgoSpacing.tight)
    }
}

#Preview("Main chip — the head of the rail, and the chip under it") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        MainChip(isSelected: true, select: {})
        ForEach(FeedAgents.all(in: FeedProjection.previewRows, of: .running)) {
            AgentChip(agent: $0)
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Main chip — unlit, the feed scoped onto an Agent instead") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        MainChip(isSelected: false, select: {})
        ForEach(FeedAgents.all(in: FeedProjection.previewRows, of: .running)) { agent in
            AgentChip(agent: agent, isSelected: agent.id == 1, scope: {})
        }
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}
