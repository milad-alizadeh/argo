extension SessionRosterProjection {
    /// What the roster does about a selection it did not make itself (#1273): the row it points the
    /// list at now, and the row it must remember to point at once it can.
    struct Reveal: Equatable {
        /// The row to scroll to in this pass, or `nil` to leave the offset where it is.
        let row: String?
        /// What the list still owes the reader a look at: a row it has no height to scroll in, or
        /// a selection it is not drawing a row for yet. `nil` once the debt is paid.
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
    /// A selection naming no drawn row is OWED rather than dropped (#1493). Two things are written
    /// before the row for them exists: a spawn's claim id, the instant the spawn answers and before
    /// the provisional row has reached this list, and a restored id whose Session the first sweep
    /// has not read yet. Dropping those left the row grounded and scrolled out of sight, which
    /// reads to the reader exactly like a lost focus. The debt is the selection's own id, and it is
    /// paid by asking again once the rows change.
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
            // A row drawn under this id that carries no ground is a fold, and a fold is the one
            // thing here that will never become a row to scroll to however long it is waited for.
            guard let selection, !drawn.contains(where: { $0.id == selection })
            else { return Reveal(row: nil, owed: nil) }
            return Reveal(row: nil, owed: selection)
        }
        return hasHeight ? Reveal(row: row, owed: nil) : Reveal(row: nil, owed: row)
    }
}
