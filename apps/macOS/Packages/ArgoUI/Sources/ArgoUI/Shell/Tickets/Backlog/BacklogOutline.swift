import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One priority band's tree, inside the list's own `List` (`cockpit-work-room.md` — the backlog
/// list).
///
/// It draws the projection's FLATTENED order (`TicketsRoomProjection.drawn`) rather than nesting
/// `View`s. Why, and what that trades away: `cockpit-work-room.inventory.md`.
package struct BacklogOutline: View {
    @Environment(\.argo) private var argo

    /// The band's rows in draw order, already flattened. Handed in rather than derived, because
    /// the header above them counts this same array (#819).
    let drawn: [TicketsRoomProjection.Drawn]
    /// Which parents the reader has folded. **Everything opens open** — a tree that opens shut
    /// hides what it was added for, so this starts empty and folding is the deliberate act.
    @Binding var shut: Set<Int>
    /// The row the reader is working in, from the list's own selection. Handed down because the
    /// row's whole treatment turns on it — the ground included (#1071).
    var selection: Int?
    /// Whether the fold is the reader's to move here. A search stands the twists down rather than
    /// drawing dead ones: it hands in a tree that is already open, and a twist that folds nothing
    /// visible is the control-that-does-nothing this room keeps refusing (#873).
    var folds = true

    package var body: some View {
        ForEach(drawn) { drawn in
            let ink = BacklogRowInk(
                isSelected: drawn.id == selection,
                isRail: drawn.row.isRail,
                palette: argo.color,
            )
            BacklogRow(
                drawn: drawn,
                isOpen: !shut.contains(drawn.id),
                ink: ink,
                toggle: folds && drawn.isParent ? { toggle(drawn.id) } : nil,
            )
            .previewSafeListRow()
            // On the ROW and from HERE: a `listRowBackground` declared inside the row's own body
            // reaches nothing, and the band it would have drawn is the platform's instead (#1071).
            // The rails' own modifier, not a second copy of its ternary (#906): since #1165 the
            // backlog wears the same ground they do, and it carries the probe that switches the
            // platform's own fill off under a held click (#1137).
            .argoSelectedRowGround(isSelected: drawn.id == selection)
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

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        drawn: [TicketsRoomProjection.Drawn],
        shut: Binding<Set<Int>>,
        selection: Int? = nil,
        folds: Bool = true,
    ) {
        self.drawn = drawn
        _shut = shut
        self.selection = selection
        self.folds = folds
    }
}
