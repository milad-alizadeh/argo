/// Where the keyboard cursor is in whichever filtering list is open, and where each key takes it
/// (#685, #687, #1231).
///
/// Held by row id and not by index, because filtering reorders the list under the cursor. Generic
/// over the id because the two lists that walk this way are keyed differently — a composer menu by
/// the command or path it draws, the ticket picker by Ticket number — and a cursor keyed by a
/// stringified number would be an id nobody could compare against the row it came from.
struct MenuCursor<ID: Hashable>: Equatable {
    /// The id the cursor is on, or `nil` where there is nothing to be on.
    private(set) var current: ID?

    /// Put the cursor back on the top row whenever the row it was on has gone — a filter that
    /// narrowed past it, or a list that emptied. It stays put while its row survives, so typing a
    /// character that does not change the match does not move it.
    mutating func settle(over ids: [ID]) {
        guard let current, ids.contains(current) else {
            current = ids.first
            return
        }
    }

    /// One row down, stopping at the bottom. It does not wrap: a list of seventy-odd things that
    /// jumped back to the top would read as the cursor having been lost.
    mutating func down(over ids: [ID]) {
        step(over: ids, by: 1)
    }

    mutating func up(over ids: [ID]) {
        step(over: ids, by: -1)
    }

    private mutating func step(over ids: [ID], by places: Int) {
        guard let current, let at = ids.firstIndex(of: current) else {
            current = ids.first
            return
        }
        let next = at + places
        guard ids.indices.contains(next) else { return }
        self.current = ids[next]
    }
}
