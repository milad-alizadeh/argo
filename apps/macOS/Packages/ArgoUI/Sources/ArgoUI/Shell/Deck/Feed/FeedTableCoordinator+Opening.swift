import AppKit

// Another reading arriving in the SAME table — a Session switch, or the rail scoped onto a
// Subagent. It used to be a view identity: `.id(session)` on the deck, which destroyed the table,
// the ten rulers, the minimap and the measured heights to reset four small facts. ADR-0028 Rule 5
// forbids exactly that, and this is what says the four facts out loud instead.
//
// Everything reset here is state whose meaning is a ROW, and `FeedRow.ID` is a dense position: a
// focused row, a fold, an open row and a wash all name a place in the reading rather than anything
// in it, so carried across they point at whatever now stands where they were. Everything NOT reset
// here is a fact about the deck — the measured heights (their own store per reading), the pane
// width, the rulers, the scroll view — and re-deriving those is the cost this whole lane is about.

extension FeedTableCoordinator {
    /// The table opened on another reading, at the cost of a reload rather than of a rebuild.
    ///
    /// A reload and not an insert: the fresh rows are not an extension of the stale ones, and the
    /// table is already showing the count it had. It drops NO height — the store this coordinator
    /// holds was swapped to the fresh reading's by `FeedTable.bind(_:through:)` before this pass,
    /// so what is in it is the fresh reading's own work and emptying it would be the #858 defect
    /// arriving by another road.
    func openAfresh() {
        // The rulers still hold the last reading's live rows, and this one is about to measure its
        // own through them.
        surrenderRulers()
        tailing?.cancel()
        settling?.cancel()
        handle?.reopen(on: shown, held: model?.held)
        // Said out loud, because nothing else says it: the reading is replaced under a table whose
        // frame may not move, and the lane beside it answers a frame report by its height.
        handle?.readingReplaced?()
        table?.reloadData()
        // A full pass straight after the reload, because a reload alone leaves the table with no
        // row geometry at all — and `place()` lands this reading off the document height in the
        // same turn. It is the cheap pass, not the expensive one: every height already known is
        // re-used, so coming back to a reading pays a synchronous ask per row and no measurement.
        remeasure(.all)
        // After the reload, so the cursor redraw finds no realised cell of a reading that has gone.
        focusedRow = nil
        folds = model?.unfolded.wrappedValue ?? []
        drawnOpen = model?.selection.open
        drawnWashed = model?.washed
    }
}
