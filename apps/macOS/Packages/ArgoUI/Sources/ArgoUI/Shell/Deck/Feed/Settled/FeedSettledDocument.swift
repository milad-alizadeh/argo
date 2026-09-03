import CoreGraphics

/// A reading at a width, with a FINAL height for every row of it. The one seam ADR-0030 Rule 3
/// adds, and the value the table, the overview lane and the deck's provisional state all read.
///
/// Complete or absent, never partial. That is the whole of the design: five feed defects in a year
/// — #473, #476, #477, the seam shake (#858) and the overprint on `9f6cd7d4` — were one bug, which
/// is that a row nobody had looked at stood at an estimate and was corrected when it scrolled in.
/// A document whose total height moves under the scroller cannot be mapped and cannot be scrolled
/// to the end of. So there is no half-measured document to hand anybody: until every row has been
/// measured this value does not exist, and the deck says so (`FeedVacancy.unread`).
///
/// It is `Sendable` because the pass that makes it runs off the main actor and across cores
/// (`FeedMeasurePass`), and it carries the STAMP it was made against so nothing can consume it
/// against a reading, a width or an ink it is not a document of.
package struct FeedSettledDocument: Sendable {
    /// What this is a document OF.
    let stamp: FeedMeasureStamp
    /// One final height per row, in the rows' own order. Index-aligned with `stamp.rows`, and the
    /// initializer is the only thing that can make that untrue.
    private let heights: [CGFloat]

    /// Made only where every row has a height. The count check is the invariant said out loud:
    /// nothing else in the feed has to ask whether a document is complete, because an incomplete
    /// one cannot be built.
    init?(stamp: FeedMeasureStamp, heights: [CGFloat]) {
        guard heights.count == stamp.rows.count else { return nil }
        self.stamp = stamp
        self.heights = heights
    }

    package var count: Int {
        heights.count
    }

    /// What row `index` stands at. `nil` for an index this document does not hold, which is a
    /// caller reading a document against rows it was not made from.
    package func height(at index: Int) -> CGFloat? {
        heights.indices.contains(index) ? heights[index] : nil
    }

    /// Every height, in order — what the overview lane sums into positions.
    package var everyHeight: [CGFloat] {
        heights
    }

    /// How tall the whole document stands. The one number the scroller and the lane have to agree
    /// on, and the reason a partial document is worthless: a sum missing a row is a sum that moves.
    package var totalHeight: CGFloat {
        heights.reduce(0, +)
    }

    /// The same document with the named rows re-measured — the two ways ADR-0030 Rule 5 allows a
    /// settled document to change, both landing here.
    ///
    /// Rows appended at the tail extend it; a Result that changed one row's height replaces that
    /// row's entry. Every OTHER height is carried through untouched by construction: this is an
    /// array write per named row and nothing else, so there is no pass a bug could hide in.
    func replacing(_ measured: [Int: CGFloat], against stamp: FeedMeasureStamp)
        -> FeedSettledDocument? {
        var settled = heights
        if stamp.rows.count > settled.count {
            settled.append(contentsOf: repeatElement(0, count: stamp.rows.count - settled.count))
        } else if stamp.rows.count < settled.count {
            settled.removeLast(settled.count - stamp.rows.count)
        }
        for (index, height) in measured where settled.indices.contains(index) {
            settled[index] = height
        }
        return FeedSettledDocument(stamp: stamp, heights: settled)
    }
}
