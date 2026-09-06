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
            // Guarded against the row already open, so pointing the window from outside the list
            // is one act and not two.
            .onChange(of: held.selection.last) { _, row in
                guard row != held.pointed else { return }
                held.pick(row)
            }
            // An EMPTY list is skipped: it draws empty for a moment between a Project switch and
            // the first reading, and reconciliation is what clears a selection for real. So is the
            // row on its way but not published yet — see `RowSelectionHold.awaited` (#1493).
            .onChange(of: drawn) { _, rows in
                guard !rows.isEmpty else { return }
                held.selection.confine(to: rows + [held.awaited].compactMap(\.self))
            }
    }
}
