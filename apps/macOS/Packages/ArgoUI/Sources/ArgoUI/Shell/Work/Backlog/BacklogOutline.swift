import SwiftUI

/// The backlog's tree, inside the list's own `List` (`cockpit-work-room.md` — the backlog list).
///
/// It draws the projection's FLATTENED order (`WorkRoomProjection.drawn`) rather than nesting
/// `View`s. Why, and what that trades away: `cockpit-work-room.inventory.md`.
struct BacklogOutline: View {
    /// The roots. Each carries its own children, so this is the tree rather than a slice of it.
    let rows: [WorkRoomProjection.Row]
    /// Which parents the reader has folded. **Everything opens open** — a tree that opens shut
    /// hides what it was added for, so this starts empty and folding is the deliberate act.
    @Binding var shut: Set<Int>

    var body: some View {
        ForEach(WorkRoomProjection.drawn(rows, shut: shut)) { drawn in
            BacklogRow(
                drawn: drawn,
                isOpen: !shut.contains(drawn.id),
                toggle: drawn.isParent ? { toggle(drawn.id) } : nil,
            )
            .previewSafeListRow()
            // On the ROW, not the list: declared on the `List` the modifier reaches nothing. A rule
            // under every row turns a list into a table.
            .listRowSeparator(.hidden)
        }
    }

    private func toggle(_ id: Int) {
        if shut.contains(id) {
            shut.remove(id)
        } else {
            shut.insert(id)
        }
    }
}

#Preview("Backlog outline — open, and with one parent folded") {
    @Previewable @State var open = Set<Int>()
    @Previewable @State var folded: Set = [607]

    HStack(spacing: ArgoSpacing.flush) {
        List { BacklogOutline(rows: WorkFixture.room.backlog, shut: $open) }
        List { BacklogOutline(rows: WorkFixture.room.backlog, shut: $folded) }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width * 2, height: 420)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Backlog outline — the provider answered with nothing") {
    List { BacklogOutline(rows: [], shut: .constant([])) }
        .listStyle(.inset)
        .frame(width: ArgoBacklogList.width, height: 240)
        .argoDeckSurface()
        .argoAppearance()
}
