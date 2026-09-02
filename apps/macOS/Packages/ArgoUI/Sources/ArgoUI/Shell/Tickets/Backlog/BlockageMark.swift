import SwiftUI

/// That something still stands between a backlog row and being startable (#896), on the row itself
/// rather than one ticket at a time in the pane beside it.
///
/// **The glyph alone.** It shipped as a glyph and a count in a capsule (#939); the count is now the
/// pane's, where `Blocked by · 6` states it against the blockers it can name. On the row it was a
/// numeral a reader could not act on, and it made the one mark that answers "can I start this"
/// heavier than the claim mark that answers "is somebody on it". The count survives in the hover
/// and in what the row speaks.
///
/// The ink is `TicketsView.blocked.ink`, the sidebar's own, so the rail's mark and the row's agree
/// on colour as well as on shape. A STRANDED mark goes to `text.disabled` instead: the edge can
/// never satisfy itself, so the row is not waiting for anything and reads as struck out rather
/// than as a louder wait. It also leaves the palette's one red spent on one state.
///
/// It is drawn only where there is something to mark — `TicketsRoomProjection.blockage` withholds
/// the value on a clear ticket and on one whose edges nobody served, so nothing here has to know
/// which of the two silences it is looking at.
struct BlockageMark: View {
    /// Shared with the sidebar's `Blocked` view, which counts exactly the rows that carry this:
    /// two glyphs would be two concepts to a reader who has to learn they are one (#939).
    nonisolated static let symbol = ArgoSymbol.blockedView

    @Environment(\.argo) private var argo

    let blockage: TicketsRoomProjection.Blockage
    /// The opaque ground to lay under the mark, where the surface under it is not one the Route's
    /// inks can be read on — a selected backlog row's loud ground reads both at 1.2:1 (#1071).
    /// `nil` on the deck, which is the ground they were chosen against.
    var backdrop: ArgoColor?

    var body: some View {
        ArgoGlyph(Self.symbol, .inline)
            .foregroundStyle(ink.color)
            // The claim mark's box, so the two sit on one vertical whether a row carries one of
            // them or both.
            .frame(minHeight: ArgoBacklogList.trailingMark)
            .argoTrailingMarkPlate(backdrop)
            .fixedSize()
            .help(help)
            // The row speaks the mark as part of one sentence — see `BacklogRow.announcement`.
            .accessibilityHidden(true)
    }

    /// What the glyph says, spelled out with the count it no longer draws.
    private var help: String {
        blockage.isStranded
            ? "\(blockage.count) blockers, one of them ruled out — the edge can only be cleared by "
            + "re-scoping one of the two."
            : "Waiting on \(blockage.count) open \(blockage.count == 1 ? "blocker" : "blockers")."
    }

    private var ink: ArgoColor {
        blockage.isStranded ? argo.color.text.disabled : TicketsView.blocked.ink(argo)
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
