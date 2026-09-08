import Foundation

// The one settle that does not go through a pass: the rows the reader's own press owes (#1691).
//
// Beside `FeedTableCoordinator+Settling` rather than inside it, which is where the decision to come
// here is taken — that file is at its length gate.

extension FeedTableCoordinator {
    /// The rows the reader's own press owes, measured and landed before this turn of the main actor
    /// ends.
    ///
    /// A press is not a burst and it is not a document: a fold of calls is a handful of rows and
    /// every one of them a LINE COUNT (`FeedShapeHeight.folded`), so there is nothing here worth a
    /// hop off the main actor — and the hop is what the reader sees. `touchUp` has already redrawn
    /// the cell in its open shape, so a height landing a hop later leaves the rows below at the
    /// closed height for that hop and then steps them down. Measured with the fix reverted, the
    /// card read 22pt and the row under it stood at y=22 on the turn of the press, and both read 66
    /// once the pass landed. Measured here they never stand at the old height at all: one commit to
    /// the display, at the final geometry.
    ///
    /// It runs INSIDE `settleIfOwed`'s own guard, which is what makes it safe: landing a document
    /// reloads the table, and the frame change that causes is where a settle is decided from.
    ///
    /// Only a fold of calls comes here. The other two shapes the reader's fold changes typeset —
    /// `FeedRow.Content.Shape.isFoldOfCalls` is where that is decided, and it is the caller's guard
    /// rather than an assertion here, because the caller is the one holding the delta.
    func settleInTurn(
        _ stamp: FeedMeasureStamp,
        measuring owed: IndexSet,
        over standing: FeedSettledDocument,
    ) {
        // The pass in flight is for a stamp this one supersedes — the same retirement `settle`
        // makes, because the answer on its way is a document of a standing the reader has left.
        settling?.cancel()
        quieting?.cancel()
        finishedQuiet()
        settlingFor = stamp
        let measured = owed.reduce(into: [Int: CGFloat]()) { measured, row in
            measured[row] = FeedMeasurePass.height(at: row, of: stamp)
        }
        noted(measured.count)
        landed(standing.replacing(measured, against: stamp), for: stamp)
    }
}
