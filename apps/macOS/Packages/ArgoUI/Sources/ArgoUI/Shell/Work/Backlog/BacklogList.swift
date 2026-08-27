import SwiftUI

/// The deck's leading pane — the backlog, flat. Its width is fixed at 520 rather than shared out
/// of the deck: 520 is the measure the titles were chosen against, and a pane that shrinks with the
/// window would put them back where the rail had them (`cockpit-work-room.md`).
struct BacklogList: View {
    let rows: [WorkRoomProjection.Row]
    @Binding var selection: Int?

    var body: some View {
        List(rows, selection: $selection) { row in
            BacklogRow(row: row)
                .previewSafeListRow()
                // On the ROW, not the list: declared on the `List` the modifier reaches nothing,
                // and the rules stayed. The row is `dot · id · title` and nothing else — a rule
                // under every one of them turns a list into a table.
                .listRowSeparator(.hidden)
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .frame(width: ArgoBacklogList.width)
        .accessibilityLabel("Backlog")
    }
}

#Preview("Backlog list") {
    @Previewable @State var selection: Int? = 272

    BacklogList(
        rows: WorkRoomProjection.room(from: WorkFixture.reading).backlog,
        selection: $selection,
    )
    .frame(height: 520)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Backlog list — the provider answered with nothing") {
    BacklogList(rows: [], selection: .constant(nil))
        .frame(height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
