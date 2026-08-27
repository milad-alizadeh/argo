import SwiftUI

/// The hero at the foot of the sidebar's scroll, answering "what should I pick up"
/// (`cockpit-work-room.md` — the Next-up hero).
///
/// Inset, on `surface.raised`, behind an `edge.subtle` border — three things a `ViewRow` has none
/// of, which is what stops it reading as another view.
struct NextUpCard: View {
    @Environment(\.argo) private var argo

    /// The card states one ticket, so its title wraps to the rail's width rather than truncating.
    /// Three is where the longest real title in the backlog sets at 280.
    static let titleLines = 3

    let nextUp: NextUp

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            GroupLabel("Next up")
            content
        }
        .padding(ArgoWorkSidebar.heroPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(argo.color.surface.raised, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
        }
        .padding(.horizontal, ArgoWorkSidebar.heroInset)
        .padding(.top, ArgoWorkSidebar.heroInset)
        .padding(.bottom, ArgoWorkSidebar.heroFootInset)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var content: some View {
        switch nextUp {
        case let .pick(pick): picked(pick)
        case .nothingUnblocked:
            sentence("Nothing is unblocked. Every open leaf is waiting on something still open.")
        case .allRunning:
            sentence("Everything takeable already has a Session running.")
        case .backlogClear:
            sentence("The backlog is clear. Nothing is waiting to be picked up.")
        }
    }

    private func picked(_ pick: NextUp.Pick) -> some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                Text("#\(pick.number)")
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
                Text(pick.title)
                    .argoText(ArgoTypography.rowTitle)
                    .foregroundStyle(argo.color.text.primary)
                    // A `List` row gives its content one line's height without the `fixedSize`.
                    .lineLimit(Self.titleLines)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if !pick.reasons.isEmpty {
                chips(pick.reasons)
            }
        }
    }

    /// One row while the chips fit, two while the reader's text size means they do not.
    private func chips(_ reasons: [NextUp.Reason]) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: ArgoSpacing.snug) { chipRun(reasons) }
            VStack(alignment: .leading, spacing: ArgoSpacing.snug) { chipRun(reasons) }
        }
    }

    private func chipRun(_ reasons: [NextUp.Reason]) -> some View {
        ForEach(reasons, id: \.words) { NextUpChip(reason: $0) }
    }

    private func sentence(_ words: String) -> some View {
        Text(words)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(argo.color.text.tertiary)
            // A `List` row truncates its content to one line without both.
            .lineLimit(nil)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview("Next-up hero — the four tiers") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        NextUpCard(nextUp: WorkFixture.room.nextUp ?? .backlogClear)
        NextUpCard(nextUp: .nothingUnblocked)
        NextUpCard(nextUp: .allRunning)
        NextUpCard(nextUp: .backlogClear)
    }
    .frame(width: ArgoLayout.sidebarMinimumWidth)
    .argoAppearance()
}

#Preview("Next-up hero — one earned chip, and a title that wraps") {
    NextUpCard(nextUp: .pick(.init(
        number: 334,
        title: "The Route — a progress-axis view of a ticket and its children",
        reasons: [.highPriority],
    )))
    .frame(width: ArgoLayout.sidebarMinimumWidth)
    .argoAppearance()
}
