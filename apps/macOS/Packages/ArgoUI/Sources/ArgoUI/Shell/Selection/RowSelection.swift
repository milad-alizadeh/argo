import Foundation

/// A list's selection as the reader built it (#1247): which rows are in it, which row a range
/// grows from, and which one row the deck is drawing.
///
/// One value for the roster and the backlog both, because a click means the same thing in each.
/// It is the SINGLE source the `List`'s own binding and Argo's drawn ground are read from — two
/// answers to "is this row selected" is two selected states on screen the moment they disagree
/// (`SessionRosterProjection.Selection`).
///
/// Every range is taken over the rows the list is DRAWING, handed in rather than held, so a row
/// behind a shut fold is not in the array and cannot be pulled into a selection nobody can see.
package struct RowSelection<Row: Hashable & Sendable>: Equatable, Sendable {
    /// Everything selected. What the menu acts on, and what the ground is drawn under.
    package private(set) var rows: Set<Row> = []
    /// The end a shift-click grows FROM. It moves on a click and on a cmd-click, never on a
    /// shift-click — that is what lets a reader swing the far end about without losing the row
    /// they started at.
    private(set) var anchor: Row?
    /// The one row a click named, which is what the deck draws. A selection of many rows draws no
    /// deck change beyond the click that started it.
    package private(set) var last: Row?

    package init() {}

    /// One row and no more — where a preview, a specimen and a restored window all start.
    package init(one row: Row?) {
        point(at: row)
    }

    /// A range already made, for a render: the whole run selected, and the deck still on the row
    /// the reader clicked FIRST — which is what a shift-click leaves behind.
    package init(range rows: [Row]) {
        self.rows = Set(rows)
        self.anchor = rows.first
        self.last = rows.first
    }

    package func contains(_ row: Row) -> Bool {
        rows.contains(row)
    }

    /// A plain click: one row, and the anchor lands on it.
    mutating func click(_ row: Row) {
        rows = [row]
        anchor = row
        last = row
    }

    /// A shift-click. Every row from the anchor to this one, both ends included, and the anchor
    /// stands so the next shift-click swings the far end rather than starting again.
    ///
    /// With no anchor to grow from — or one the list is no longer drawing — there is no range to
    /// take, so this is the click the reader has not made yet.
    mutating func extend(to row: Row, over visible: [Row]) {
        guard let anchor,
              let from = visible.firstIndex(of: anchor),
              let to = visible.firstIndex(of: row)
        else { return click(row) }
        rows = Set(visible[min(from, to) ... max(from, to)])
    }

    /// A cmd-click: this row in or out on its own, and the anchor lands on it either way, so the
    /// next shift-click grows from where the reader last pointed.
    mutating func toggle(_ row: Row) {
        if rows.contains(row) {
            rows.remove(row)
            if last == row {
                last = nil
            }
        } else {
            rows.insert(row)
            last = row
        }
        anchor = row
    }

    /// What a menu opened on this row acts on. A row already in the selection leaves it whole —
    /// the menu is about all of it. A row outside is the whole of what the menu acts on, so it
    /// never reaches rows the pointer is nowhere near.
    ///
    /// Read rather than written, because a `contextMenu`'s items are built during a view pass and
    /// nothing may be mutated there. The visible collapse is the `List`'s own: a right-click
    /// outside the selection moves it, and that arrives back through `absorb`.
    package func aim(at row: Row) -> Set<Row> {
        rows.contains(row) ? rows : [row]
    }

    /// The selection cut back to what the list is drawing now. A row that folded away, archived
    /// itself or simply left is not selected any more, or the menu would act on rows nobody can
    /// see.
    mutating func confine(to visible: [Row]) {
        let drawn = Set(visible)
        rows.formIntersection(drawn)
        anchor = anchor.flatMap { drawn.contains($0) ? $0 : nil }
        last = last.flatMap { rows.contains($0) ? $0 : nil }
    }

    /// The window pointed at a row by something that is not a click on this list — a link, a
    /// reveal, reconciliation. One click's worth of selection, never an addition to what the
    /// reader had built.
    mutating func point(at row: Row?) {
        guard let row else {
            rows = []
            anchor = nil
            last = nil
            return
        }
        click(row)
    }

    /// What the `List` itself selected, taken back in. The platform owns the click that lands
    /// anywhere but the row's own gestures, and this is the one way its answer reaches the anchor
    /// and the deck: a set of one is a plain click, and any wider set leaves both where the click
    /// that started it put them.
    mutating func absorb(_ selected: Set<Row>) {
        guard selected != rows else { return }
        if selected.count == 1, let one = selected.first {
            return click(one)
        }
        rows = selected
        anchor = anchor.flatMap { selected.contains($0) ? $0 : nil }
        last = last.flatMap { selected.contains($0) ? $0 : nil }
    }
}
