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
    /// What the reader has done to this pane, and what they may do to it: the fold, the
    /// selection, and the menu's verbs. Handed down whole because the row's treatment turns on all
    /// three — the ground included (#1071), and since #1247 the menu with it.
    ///
    /// **Everything opens open** — a tree that opens shut hides what it was added for, so the fold
    /// starts empty and folding is the deliberate act.
    var held: BacklogList.Held
    /// Whether the fold is the reader's to move here. A search stands the twists down rather than
    /// drawing dead ones: it hands in a tree that is already open, and a twist that folds nothing
    /// visible is the control-that-does-nothing this room keeps refusing (#873).
    var folds = true

    package var body: some View {
        ForEach(drawn) { drawn in
            // ONE reading of "is this row selected", for both halves that draw it: the ground and
            // the ink read on that ground. Two would be two selected states the moment they
            // disagree — the roster's own rule (`SessionRosterProjection.Selection`).
            let isSelected = held.picking.selection.contains(drawn.id)
            let ink = BacklogRowInk(
                isSelected: isSelected,
                isRail: drawn.row.isRail,
                palette: argo.color,
            )
            BacklogRow(
                drawn: drawn,
                isOpen: !held.shut.contains(drawn.id),
                ink: ink,
                toggle: folds && drawn.isParent ? { toggle(drawn.id) } : nil,
            )
            .previewSafeListRow()
            // On the ROW and from HERE: a `listRowBackground` declared inside the row's own body
            // reaches nothing, and the band it would have drawn is the platform's instead (#1071).
            // The rails' own modifier, not a second copy of its ternary (#906): since #1165 the
            // backlog wears the same ground they do, and it carries the probe that switches the
            // platform's own fill off under a held click (#1137).
            .argoSelectedRowGround(isSelected: isSelected)
            // On the ROW rather than inside it: a menu declared in the row's own body would be
            // one more thing `BacklogRow` takes, and what it acts on is the LIST's selection.
            .contextMenu {
                BacklogRowMenu(
                    targets: held.acts.targets(of: drawn.id, in: held.picking.selection),
                    acts: held.acts,
                )
            }
            // On the ROW, not the list: declared on the `List` the modifier reaches nothing. A rule
            // under every row turns a list into a table.
            .listRowSeparator(.hidden)
        }
    }

    private func toggle(_ id: Int) {
        if held.shut.contains(id) {
            held.shut.remove(id)
        } else {
            held.shut.insert(id)
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        drawn: [TicketsRoomProjection.Drawn],
        held: BacklogList.Held,
        folds: Bool = true,
    ) {
        self.drawn = drawn
        self.held = held
        self.folds = folds
    }
}
