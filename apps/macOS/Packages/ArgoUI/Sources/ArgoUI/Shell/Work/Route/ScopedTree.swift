import SwiftUI

/// The `Tree` half of a chart's deck — the node tree, scoped to one parent (#335).
///
/// `BacklogOutline` reused rather than re-authored. The backlog's own pane is not: it bands by
/// priority, which says nothing inside one parent, and it fixes itself at 520, which is the width
/// twelve real titles were chosen against rather than anything a chart wants.
struct ScopedTree: View {
    /// The chart's subtree, rooted at the parent.
    let rows: [WorkRoomProjection.Row]
    @Binding var selection: Int?
    /// The two presentations share one fold, so a parent folded in the tree stays folded.
    @Binding var shut: Set<Int>

    var body: some View {
        List(selection: $selection) {
            BacklogOutline(drawn: WorkRoomProjection.drawn(rows, shut: shut), shut: $shut)
        }
        .listStyle(.inset)
        .scrollContentBackground(.hidden)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityLabel("The chart's children")
    }
}

#Preview("Scoped tree — one chart's subtree") {
    @Previewable @State var selection: Int? = 334
    @Previewable @State var shut: Set<Int> = []

    ScopedTree(rows: WorkFixture.chartRoom.backlog, selection: $selection, shut: $shut)
        .frame(width: 720, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Scoped tree — a parent folded") {
    @Previewable @State var selection: Int? = 334
    @Previewable @State var shut: Set = [334]

    ScopedTree(rows: WorkFixture.chartRoom.backlog, selection: $selection, shut: $shut)
        .frame(width: 720, height: 420)
        .argoDeckSurface()
        .argoAppearance()
}
