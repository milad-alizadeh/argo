import SwiftUI

/// One priority band's tree, inside the list's own `List` (`cockpit-work-room.md` — the backlog
/// list).
///
/// It draws the projection's FLATTENED order (`TicketsRoomProjection.drawn`) rather than nesting
/// `View`s. Why, and what that trades away: `cockpit-work-room.inventory.md`.
struct BacklogOutline: View {
    /// The band's rows in draw order, already flattened. Handed in rather than derived, because
    /// the header above them counts this same array (#819).
    let drawn: [TicketsRoomProjection.Drawn]
    /// Which parents the reader has folded. **Everything opens open** — a tree that opens shut
    /// hides what it was added for, so this starts empty and folding is the deliberate act.
    @Binding var shut: Set<Int>
    /// Whether the fold is the reader's to move here. A search stands the twists down rather than
    /// drawing dead ones: it hands in a tree that is already open, and a twist that folds nothing
    /// visible is the control-that-does-nothing this room keeps refusing (#873).
    var folds = true

    var body: some View {
        ForEach(drawn) { drawn in
            BacklogRow(
                drawn: drawn,
                isOpen: !shut.contains(drawn.id),
                toggle: folds && drawn.isParent ? { toggle(drawn.id) } : nil,
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
    let high = TicketsRoomProjection.bands(of: TicketsFixture.room.backlog)[0]

    HStack(spacing: ArgoSpacing.flush) {
        List { BacklogOutline(drawn: TicketsRoomProjection.drawn(high, shut: open), shut: $open) }
        List {
            BacklogOutline(drawn: TicketsRoomProjection.drawn(high, shut: folded), shut: $folded)
        }
    }
    .listStyle(.inset)
    .frame(width: ArgoBacklogList.width * 2, height: 420)
    .argoDeckSurface()
    .argoAppearance()
    .environment(\.backlogNow, TicketsFixture.asOf)
}

#Preview("Backlog outline — the provider answered with nothing") {
    List { BacklogOutline(drawn: [], shut: .constant([])) }
        .listStyle(.inset)
        .frame(width: ArgoBacklogList.width, height: 240)
        .argoDeckSurface()
        .argoAppearance()
        .environment(\.backlogNow, TicketsFixture.asOf)
}
