import SwiftUI

/// The deck's leading pane — the backlog, flat. Its width is fixed at 520 rather than shared out
/// of the deck: 520 is the measure the titles were chosen against, and a pane that shrinks with the
/// window would put them back where the rail had them (`cockpit-work-room.md`).
struct BacklogList: View {
    let rows: [WorkRoomProjection.Row]
    @Binding var selection: Int?
    /// Which parents are folded. Held above the pane for the same reason the ticket is: a fold the
    /// reader made outlives the pane, and it is what a specimen seeds to shoot `collapsed.png`.
    @Binding var shut: Set<Int>

    var body: some View {
        List(selection: $selection) {
            BacklogOutline(rows: rows, shut: $shut)
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

#Preview("Backlog list — a parent folded, its roll-up standing for its children") {
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
