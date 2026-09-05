extension SessionRosterProjection {
    /// What the roster does about a selection it did not make itself (#1273): the row it points the
    /// list at now, and the row it must remember to point at once it can.
    struct Reveal: Equatable {
        /// The row to scroll to in this pass, or `nil` to leave the offset where it is.
        let row: String?
        /// The row still owed, because the list had no height to scroll in. `nil` once it is paid.
        let owed: String?
    }

    /// The row the roster scrolls into view for a selection, and whether it can do it yet.
    ///
    /// The selection is written from surfaces that are not the roster — the Tickets room's
    /// claimant line, the feed's handoff mark, the menu bar — and each of those leaves the mark on
    /// a row that can be anywhere in a roster of a hundred and eighty (#1273).
    ///
    /// Answered off the rows the roster is DRAWING, not the Sessions it holds: a selection behind
    /// a shut foot or inside a shut fold carries no row of its own. Asked through
    /// `Selection.isSelected` rather than by repeating its rule, so the row the list is pointed at
    /// is by construction the row the ground is under.
    ///
    /// `hasHeight` is the thing this could not be a pure question of the rows about. A room that is
    /// off screen is still MOUNTED, at `maxHeight: 0` (`RoomStage`), and the Tickets room's
    /// claimant line writes the selection before it switches rooms
    /// (`TicketsRoom.openSession`) — so the ask can land on a list with no height to scroll in,
    /// which is the one case where doing nothing looks exactly like the bug.
    static func reveal(
        of selection: String?, among drawn: [Row], hasHeight: Bool,
    )
        -> Reveal {
        let ground = Selection(named: selection)
        guard let row = drawn.first(where: ground.isSelected)?.id else {
            return Reveal(row: nil, owed: nil)
        }
        return hasHeight ? Reveal(row: row, owed: nil) : Reveal(row: nil, owed: row)
    }
}
