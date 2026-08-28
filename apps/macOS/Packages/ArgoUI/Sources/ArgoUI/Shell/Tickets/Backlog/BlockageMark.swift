import SwiftUI

/// How many blockers still stand between a backlog row and being startable (#896), on the row
/// itself rather than one ticket at a time in the pane beside it.
///
/// A COUNT and not a flag: blocked by three and blocked by one are different distances from
/// startable. It is drawn only where there is something to count — `TicketsRoomProjection.blockage`
/// withholds the value on a clear ticket and on one whose edges nobody served, so nothing here has
/// to know which of the two silences it is looking at.
///
/// The ink is the Route's, unchanged (`cockpit-work-room.md` — the Route): waiting is `state.idle`,
/// so a list of blocked tickets does not read as an emergency on day one, and `state.failure` is
/// spent only on the one that can never unblock itself.
struct BlockageMark: View {
    @Environment(\.argo) private var argo

    let blockage: TicketsRoomProjection.Blockage

    var body: some View {
        Text("\(blockage.count)")
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(ink.color)
            .padding(.horizontal, ArgoSpacing.tight)
            .frame(minWidth: ArgoBacklogList.blockageMark, minHeight: ArgoBacklogList.blockageMark)
            .background(Capsule().strokeBorder(ink.color, lineWidth: ArgoStroke.hairline))
            // Rigid for the `#id`'s reason: a mark that gave up width would set its own digits down
            // the column rather than let the title take the squeeze.
            .fixedSize()
            .help(help)
            // The row speaks the mark as part of one sentence — see `BacklogRow.announcement`.
            .accessibilityHidden(true)
    }

    /// A bare numeral in a capsule has to say what it counts, on the same terms the roll-up beside
    /// it does.
    private var help: String {
        blockage.isStranded
            ? "\(blockage.count) blockers, one of them ruled out — the edge can only be cleared by "
            + "re-scoping one of the two."
            : "Waiting on \(blockage.count) open \(blockage.count == 1 ? "blocker" : "blockers")."
    }

    private var ink: ArgoColor {
        blockage.isStranded ? argo.color.state.failure : argo.color.state.idle
    }
}

#Preview("Blockage mark — waiting, waiting on several, and stranded") {
    HStack(spacing: ArgoSpacing.comfortable) {
        BlockageMark(blockage: .init(count: 1, isStranded: false))
        BlockageMark(blockage: .init(count: 6, isStranded: false))
        BlockageMark(blockage: .init(count: 2, isStranded: true))
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
