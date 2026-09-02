import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The way to the Agents that have landed — a count and a chevron at the FOOT of the rail
/// (`docs/designs/cockpit-session-interior-decisions.md` C3a.1c).
///
/// At the foot because the rail reads downward in handover order and this stands for the work
/// behind the live ones. Drawn like the count line above it, and for that line's own reason (D33):
/// `sectionLabel` on `text.tertiary`, `.plain`, no filled ground.
struct AgentsRailFinished: View {
    @Environment(\.argo) private var argo

    /// How many are held back. Never zero — the caller draws nothing rather than an affordance that
    /// opens onto an empty list.
    let count: Int
    /// A value and a verb, not a binding: the rail answers what "revealed" means, for this chevron
    /// and for the chips above it alike — `RosterArchiveFoot`'s shape, which is the same control.
    let isShowing: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: ArgoSpacing.snug) {
                Text(AgentsRailCopy.finished(count))
                    .argoText(ArgoTypography.sectionLabel)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                Spacer(minLength: ArgoSpacing.flush)
                // The atom's own two rungs and no rotation of its own: the angle reports the state.
                ArgoDisclosure(isShowing ? .below : .beside)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            isShowing ? AgentsRailCopy.hideFinished(count) : AgentsRailCopy.revealFinished(count),
        )
        // Never `.isSelected`: in this rail that trait means "the feed is scoped onto this chip"
        // (`AgentChip`, `MainChip`), so an open disclosure would announce itself as a selected
        // Agent.
        .accessibilityValue(isShowing ? "Expanded" : "Collapsed")
    }
}

#Preview("Agents rail foot — shut, and opened onto the ones that landed") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        AgentsRailFinished(count: 7, isShowing: false, toggle: {})
        AgentsRailFinished(count: 7, isShowing: true, toggle: {})
    }
    .padding(ArgoSpacing.comfortable)
    .frame(width: ArgoAgentsRail.width)
    .argoDeckSurface()
    .argoAppearance()
}
