/// One click, applied to a selection — split off `RowSelection.swift` so that file stays the
/// value and this stays what a pointer does to it.
extension RowSelection {
    /// The three cases are the whole of what a pointer can say to a list, so each list wires this
    /// once rather than branching on modifiers in its own row.
    mutating func apply(_ click: RowClick, to row: Row, over visible: [Row]) {
        switch click {
        case .plain: self.click(row)
        case .extending: extend(to: row, over: visible)
        case .toggling: toggle(row, over: visible)
        }
    }

    /// The same click, plus the one thing a list cannot see by watching `last`: whether the reader
    /// plainly clicked the row the deck is ALREADY drawing. That is a second act, not a no-op — a
    /// resume the agent refused is retried by clicking its row again (#10).
    mutating func retriesDrawnRow(
        _ click: RowClick, on row: Row, over visible: [Row],
    )
        -> Bool {
        let before = last
        apply(click, to: row, over: visible)
        return click == .plain && last == before
    }
}
