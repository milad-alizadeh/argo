/// Where the keyboard cursor is in the `/` menu, and where each key takes it (#685).
///
/// Held by COMMAND rather than by index, because filtering reorders the list under the cursor: an
/// index would jump to whatever row happened to inherit the number, and the reader would watch
/// their selection move to something they never chose.
///
/// A value rather than view state so the walk is testable without a render — the design's claim
/// that the menu is navigable by keyboard alone is a behaviour, not a look.
struct CommandMenuCursor: Equatable {
    /// The command the cursor is on, or `nil` where there is nothing to be on.
    private(set) var marked: String?

    /// Put the cursor back on the top row whenever the row it was on has gone — a filter that
    /// narrowed past it, or a list that emptied. It stays put while its row survives, so typing a
    /// character that does not change the match does not move it.
    mutating func settle(over rows: [CommandMenuProjection.Row]) {
        guard let marked, rows.contains(where: { $0.command == marked }) else {
            marked = rows.first?.command
            return
        }
    }

    /// One row down, stopping at the bottom. It does not wrap: a list of seventy-odd things that
    /// jumped back to the top would read as the cursor having been lost.
    mutating func down(over rows: [CommandMenuProjection.Row]) {
        step(over: rows, by: 1)
    }

    mutating func up(over rows: [CommandMenuProjection.Row]) {
        step(over: rows, by: -1)
    }

    private mutating func step(over rows: [CommandMenuProjection.Row], by places: Int) {
        guard let marked, let at = rows.firstIndex(where: { $0.command == marked }) else {
            marked = rows.first?.command
            return
        }
        let next = at + places
        guard rows.indices.contains(next) else { return }
        self.marked = rows[next].command
    }

    /// The row ⏎ would insert, and `nil` where there is none — which is what leaves the empty
    /// state's Return to the field, so a line nothing matched still sends as written (decision 8).
    func row(in rows: [CommandMenuProjection.Row]) -> CommandMenuProjection.Row? {
        rows.first { $0.command == marked }
    }
}
