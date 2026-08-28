import SwiftUI

/// The `Tree` half of a chart's deck — the ordinary node tree, SCOPED to one parent (#335).
///
/// `BacklogOutline` reused rather than re-authored: the tree is the same tree, and the two things
/// the backlog's own pane adds are exactly the two a chart does not want. It bands by priority,
/// which is an ordering over a whole backlog and says nothing inside one parent, and it fixes
/// itself at 520 because that is the width twelve real titles were chosen against — a chart has the
/// whole deck.
struct ScopedTree: View {
    /// The chart's subtree, rooted at the parent.
    let rows: [WorkRoomProjection.Row]
    @Binding var selection: Int?
    /// Which parents are folded. Above the pane for the same reason the backlog's is: a fold the
    /// reader made outlives the pane, and the two panes share one set.
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
