import ArgoDesign
import ArgoUI
import SwiftUI

/// A roster with a RANGE selected (#1247) — the state a shift-click leaves behind, and the one
/// thing about it worth a render: three grounds in a row, drawn the same as one, with no second
/// treatment marking which of them the deck is on.
///
/// The claim is that a range reads as one block rather than as three separate selections, and that
/// the rows between the ends are grounded exactly as their ends are.
struct RangeSelectedRosterSpecimen: View {
    var body: some View {
        SessionNavigator(
            rows: ArchivedRosterSpecimen.rows,
            held: .init(
                selection: .constant(RowSelection(range: selected)),
                pointed: selected.first,
            ),
        )
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }

    /// Every kept row, so the range runs the whole list and the ground's ends are both on screen.
    private var selected: [String] {
        ArchivedRosterSpecimen.rows.map(\.id)
    }
}

/// The backlog's own range (#1247), which is the same claim over the other list: the grounds run
/// continuously down the tree, and a row whose parent is folded away is not in the range at all.
struct RangeSelectedBacklogSpecimen: View {
    var body: some View {
        BacklogList(
            rows: TicketsFixture.room.backlog,
            held: .init(
                picking: .init(selection: .constant(RowSelection(range: selected))),
                shut: .constant([]),
            ),
        )
        .frame(width: ArgoBacklogList.width, height: 520)
        .argoDeckSurface()
    }

    /// Three rows from the head of the first band, in the order the list draws them.
    private var selected: [Int] {
        guard let first = TicketsRoomProjection.bands(of: TicketsFixture.room.backlog).first
        else { return [] }
        return TicketsRoomProjection.drawn(first, shut: []).prefix(3).map(\.id)
    }
}
