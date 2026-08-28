import SwiftUI

/// The deck's leading pane — the backlog, banded by priority over its roots (#819). Its width is
/// the CALLER's: the pane rests at `ArgoBacklogList.width`, which is the measure the titles were
/// chosen against, and the reader drags it from there (`WorkRoom.deck`). It carries no frame of
/// its own — #836's `minWidth/idealWidth/maxWidth` let the `HStack` distribute the deck between
/// the two panes, and the seam settles that now. The floor those named survives as the seam's
/// (`ArgoLayout.backlogWidths`).
struct BacklogList: View {
    /// The tree's roots, banded here: which rows a band draws depends on the fold, which is the
    /// pane's state rather than the room's.
    let rows: [WorkRoomProjection.Row]
    @Binding var selection: Int?
    /// Which parents are folded. Held above the pane for the same reason the ticket is: a fold the
    /// reader made outlives the pane, and it is what a specimen seeds to shoot `collapsed.png`.
    @Binding var shut: Set<Int>
    /// What the heading over the list says. Words only — the controls that narrow the list are in
    /// the window's row with the rest of the room's, see `WorkToolbar`.
    var header: WorkChromeProjection.Reading = .none

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            BacklogHeader(reading: header)
            list
        }
    }

    private var list: some View {
        List(selection: $selection) {
            ForEach(WorkRoomProjection.bands(of: rows)) { band in
                // Flattened ONCE and handed to both, so the header counts the rows the outline
                // draws rather than a second answer to the same question.
                let drawn = WorkRoomProjection.drawn(band, shut: shut)
                // `.inset` spends about 52 between one section and the next section's word where
                // the design draws 12, and `listSectionSpacing` is unavailable on macOS — so this
                // is a row rather than the `Section` header the frozen name stands in for, and
                // `selectionDisabled` returns the selection behaviour that cost. What it does not
                // return is pinning: `cockpit-work-room.inventory.md`.
                PriorityHeader(band: band, count: drawn.count)
                    .previewSafeListRow()
                    .listRowSeparator(.hidden)
                    .selectionDisabled()
                BacklogOutline(drawn: drawn, shut: $shut)
            }
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .accessibilityLabel("Backlog")
    }
}

#Preview("Backlog list — everything open") {
    @Previewable @State var selection: Int? = 272
    @Previewable @State var shut: Set<Int> = []

    BacklogList(rows: WorkFixture.room.backlog, selection: $selection, shut: $shut)
        .frame(width: ArgoBacklogList.width, height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog list — a parent folded, and its header's count with it") {
    @Previewable @State var selection: Int? = 607
    @Previewable @State var shut: Set = [607]

    BacklogList(rows: WorkFixture.room.backlog, selection: $selection, shut: $shut)
        .frame(width: ArgoBacklogList.width, height: 520)
        .argoDeckSurface()
        .argoAppearance()
}

// The state that SHIPS: no port reads a priority yet (#388), so every root bands under the one
// header that says nothing was read rather than being dropped by three that cannot hold it.
#Preview("Backlog list — nobody read a priority") {
    @Previewable @State var shut: Set<Int> = []
    let unread = WorkRoomProjection.room(from: WorkFixture.reading(of: WorkFixture.items)).backlog

    BacklogList(rows: unread, selection: .constant(nil), shut: $shut)
        .frame(width: ArgoBacklogList.width, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog list — the provider answered with nothing") {
    BacklogList(rows: [], selection: .constant(nil), shut: .constant([]))
        .frame(width: ArgoBacklogList.width, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
