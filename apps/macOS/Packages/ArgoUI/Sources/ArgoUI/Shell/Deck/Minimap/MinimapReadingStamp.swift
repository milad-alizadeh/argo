import Foundation

/// Everything a `MinimapReading` is a function of, in a form that costs no walk to take.
///
/// A reading is a `MinimapRow` per row of the document — a `ProseReading.structure` each, and a
/// full ruler measure for every row whose height is not already known — so the lane has to be able
/// to ask whether the one it holds is still true without taking another. This is that question, and
/// `FeedTableCoordinator.reading(at:)` derives the reading FROM it, so the two cannot come to
/// disagree about what a reading depends on.
///
/// Why the document's HEIGHT is not a sound stamp on its own, which is what the lane used to hold:
/// a row rewritten at the same height changes the miniature and moves no height at all, and a lane
/// drawing a confident picture of a document it has not re-read is a rendered lie.
///
/// `measurements` is what makes the heights sound. Every height in `FeedGeometry` arrives through
/// one ruler measure, so a count that has not moved is a store that has gained no new height — and
/// a height dropped and taken again under the same `Ground` at the same width comes back the same
/// number. It errs the loud way (degrade-down): a re-measure that landed on the value it already
/// had still counts, so the lane re-reads a document that did not change rather than the reverse.
package struct MinimapReadingStamp: Equatable {
    /// The rows themselves — what a rewrite at an unchanged height moves, and what the shapes in
    /// each `MinimapRow` are read out of.
    package var rows: [FeedRow] = []
    /// The reader's own folds: the one state that changes a row's SHAPE rather than its height.
    var unfolded: Set<FeedRow.ID> = []
    /// How many ruler measures the feed has run, ever — see above.
    var measurements = 0
    /// The four measures a `MinimapReading` carries besides its rows.
    var columnWidth: CGFloat = 0
    var viewportHeight: CGFloat = 0
    var topInset: CGFloat = 0
    var bottomInset: CGFloat = 0
    /// Whether the feed's own heights are provisional — a width burst whose full pass it has
    /// deferred, or that pass still running a batch a turn.
    ///
    /// Part of the stamp rather than beside it, so the moment it clears reads as a change like any
    /// other. A walk taken while it is set re-measures the whole document at burst rate, which is
    /// exactly the work the feed sliced into batches so that nothing would.
    var isProvisional = false

    /// Whether the two stamps are of the same DOCUMENT — the same rows, folded the same way.
    ///
    /// This is the line a provisional height may not be waited out across. A height the feed is
    /// still squaring is a number about to be corrected, and the lane can hold the one it read; a
    /// row that arrived or was rewritten is a different document, and a lane holding through one
    /// would draw a confident picture of something that is not there. Degrade-down: waiting is
    /// allowed only where what is held is still a reading OF this document.
    func isOfSameDocument(as other: Self) -> Bool {
        rows == other.rows && unfolded == other.unfolded
    }
}
