import SwiftUI

/// The deck's leading pane — the backlog, banded by priority over its roots (#819). Its width is
/// fixed at 520 rather than shared out of the deck: 520 is the measure the titles were chosen
/// against, and a pane that shrinks with the window would put them back where the rail had them
/// (`cockpit-work-room.md`).
struct BacklogList: View {
    /// The tree's roots. Banded here rather than in the room, because which rows a band DRAWS
    /// depends on the fold — which is the pane's state, not the room's.
    let rows: [WorkRoomProjection.Row]
    @Binding var selection: Int?
    /// Which parents are folded. Held above the pane for the same reason the ticket is: a fold the
    /// reader made outlives the pane, and it is what a specimen seeds to shoot `collapsed.png`.
    @Binding var shut: Set<Int>

    var body: some View {
        List(selection: $selection) {
            ForEach(WorkRoomProjection.bands(of: rows)) { band in
                // Flattened ONCE and handed to both: the header counts the rows the outline draws,
                // and two callers of `drawn` could come to disagree about what is under the fold.
                let drawn = WorkRoomProjection.drawn(band, shut: shut)
                // A ROW rather than a `Section` header, which is what the frozen name stands in
                // for. `.inset` spends about 52 between one section and the next word where the
                // design draws 12, and macOS exposes no lever on it — `listSectionSpacing` is
                // iOS-only. The one thing a `Section` was buying, a header outside the selection,
                // `selectionDisabled` gives back: the header is not selectable and the keyboard
                // steps over it.
                PriorityHeader(band: band, count: drawn.count)
                    .previewSafeListRow()
                    .listRowSeparator(.hidden)
                    .selectionDisabled()
                BacklogOutline(drawn: drawn, shut: $shut)
            }
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .frame(width: ArgoBacklogList.width)
        .accessibilityLabel("Backlog")
    }
}

#Preview("Backlog list — everything open") {
    @Previewable @State var selection: Int? = 272
    @Previewable @State var shut: Set<Int> = []

    BacklogList(rows: WorkFixture.room.backlog, selection: $selection, shut: $shut)
        .frame(height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog list — a parent folded, and its header's count with it") {
    @Previewable @State var selection: Int? = 607
    @Previewable @State var shut: Set = [607]

    BacklogList(rows: WorkFixture.room.backlog, selection: $selection, shut: $shut)
        .frame(height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog list — the provider answered with nothing") {
    BacklogList(rows: [], selection: .constant(nil), shut: .constant([]))
        .frame(height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
