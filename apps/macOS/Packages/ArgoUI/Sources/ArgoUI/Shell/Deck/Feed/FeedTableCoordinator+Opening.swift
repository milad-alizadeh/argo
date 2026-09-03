import AppKit

// Another reading arriving in the SAME table — a Session switch, or the rail scoped onto a
// Subagent. It used to be a view identity: `.id(session)` on the deck, which destroyed the table,
// the minimap and the measured heights to reset four small facts. ADR-0028 Rule 5
// forbids exactly that, and this is what says the four facts out loud instead.
//
// Everything reset here is state whose meaning is a ROW, and `FeedRow.ID` is a dense position: a
// focused row, a fold, an open row and a wash all name a place in the reading rather than anything
// in it, so carried across they point at whatever now stands where they were. Everything NOT reset
// here is a fact about the deck — the settled document (its own store per reading), the pane width,
// the scroll view — and re-deriving those is the cost this whole lane is about.

extension FeedTableCoordinator {
    /// The table opened on another reading — on that reading's own settled document where one is
    /// still held, and on nothing at all where none is.
    ///
    /// It drops NO geometry: the store this coordinator holds was swapped to the fresh reading's by
    /// `FeedTable.bind(_:through:)` before this pass, so what is in it is the fresh reading's own
    /// work and emptying it would be the #858 defect arriving by another road. What it does do is
    /// put the table on whatever that store holds — the whole document, or the empty table the
    /// deck's provisional state stands over until a pass lands one.
    func openAfresh() {
        settling?.cancel()
        settlingFor = nil
        shown = geometry.settled?.stamp.rows ?? []
        handle?.settled(geometry.isSettled)
        handle?.reopen(on: shown, held: model?.held)
        // Said out loud, because nothing else says it: the reading is replaced under a table whose
        // frame may not move, and the lane beside it answers a frame report by its height.
        handle?.readingReplaced?()
        table?.reloadData()
        // After the reload, so the cursor redraw finds no realised cell of a reading that has gone.
        focusedRow = nil
        folds = model?.unfolded.wrappedValue ?? []
        drawnOpen = model?.selection.open
        drawnWashed = model?.washed
    }
}
