import ArgoAtoms
import ArgoDesign
import SwiftUI

/// That a live Session is on this ticket, on the backlog row itself
/// (#1074; `cockpit-work-room.md` — the trailing region).
struct ClaimMark: View {
    /// Shared with the sidebar's `In progress` view, which counts exactly the rows that carry this.
    nonisolated static let symbol = ArgoSymbol.inProgressView

    @Environment(\.argo) private var argo

    /// The opaque ground to lay under the mark, for `BlockageMark`'s reason (#1071): a selected
    /// row's loud accent is not a ground `state.running` was chosen against.
    var backdrop: ArgoColor?

    var body: some View {
        ArgoGlyph(Self.symbol, .inline)
            .foregroundStyle(TicketsView.inProgress.ink(argo).color)
            // The blockage mark's box, so the two sit on one vertical whether a row carries one
            // of them or both.
            .frame(minHeight: ArgoBacklogList.trailingMark)
            .argoTrailingMarkPlate(backdrop)
            .fixedSize()
            .help("A live Session is on this ticket.")
            // The row speaks the mark as part of one sentence — see `BacklogRow.announcement`.
            .accessibilityHidden(true)
    }
}

#Preview("Claim mark — beside a blockage mark, and alone") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ClaimMark()
        HStack(spacing: ArgoBacklogList.gap) {
            ClaimMark()
            BlockageMark(blockage: .init(count: 2, isStranded: false))
        }
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
