/// Where the keyboard cursor is in whichever composer menu is open, and where each key takes it
/// (#685; keyed by id rather than by command since #687, so the `@` menu walks with the same one).
///
/// Held by IDENTITY rather than by index, because filtering reorders the list under the cursor: an
/// index would jump to whatever row happened to inherit the number. One cursor and not two, because
/// only one menu is ever open — `/` opens at the head of the line and `@` on a trailing token.
struct ComposerMenuCursor: Equatable {
    /// The id the cursor is on, or `nil` where there is nothing to be on.
    private(set) var marked: String?

    /// Put the cursor back on the top row whenever the row it was on has gone — a filter that
    /// narrowed past it, or a list that emptied. It stays put while its row survives, so typing a
    /// character that does not change the match does not move it.
    mutating func settle(over ids: [String]) {
        guard let marked, ids.contains(marked) else {
            marked = ids.first
            return
        }
    }

    /// One row down, stopping at the bottom. It does not wrap: a list of seventy-odd things that
    /// jumped back to the top would read as the cursor having been lost.
    mutating func down(over ids: [String]) {
        step(over: ids, by: 1)
    }

    mutating func up(over ids: [String]) {
        step(over: ids, by: -1)
    }

    private mutating func step(over ids: [String], by places: Int) {
        guard let marked, let at = ids.firstIndex(of: marked) else {
            marked = ids.first
            return
        }
        let next = at + places
        guard ids.indices.contains(next) else { return }
        self.marked = ids[next]
    }

    /// The row ⏎ would take, and `nil` where there is none — which is what leaves the empty
    /// state's Return to the field, so a line nothing matched still sends as written (decision 8).
    func row<Row: Identifiable>(in rows: [Row]) -> Row? where Row.ID == String {
        rows.first { $0.id == marked }
    }
}
