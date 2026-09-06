import SwiftUI

/// The two things every list bound to a `RowSelection` has to do as the reader works (#1247),
/// written once for the roster and the backlog both.
///
/// One: the surface beside the list follows the last row CLICKED, wherever the click landed — a
/// row's own gesture layer, the platform's row, or the keyboard. Two: a row the list has stopped
/// drawing is not selected any more, so a fold shut over a range cannot leave a menu offering to
/// act on what is behind it.
struct RowSelectionReactions<Row: Hashable & Sendable>: ViewModifier {
    var held: RowSelectionHold<Row>
    /// Every row the list is drawing now, in its order.
    let drawn: [Row]

    func body(content: Content) -> some View {
        content
            // The rule is `RowSelectionHold.followClick`'s: a row already open moves nothing, and
            // neither does a selection the list emptied on its own.
            .onChange(of: held.selection.last) { _, row in
                held.followClick(to: row)
            }
            // An EMPTY list is skipped: it draws empty for a moment between a Project switch and
            // the first reading, and reconciliation is what clears a selection for real. What else
            // survives the cut is `RowSelectionHold.confineToDrawn`'s to say.
            .onChange(of: drawn) { _, rows in
                guard !rows.isEmpty else { return }
                held.confineToDrawn(rows)
            }
    }
}
