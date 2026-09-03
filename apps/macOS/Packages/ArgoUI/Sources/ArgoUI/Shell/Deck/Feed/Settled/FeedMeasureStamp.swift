import CoreGraphics
import SwiftUI

/// Everything a row's height is a fact about, for a whole reading at once — the rows, the reader's
/// two states over them, the width and the ink.
///
/// It is the identity of a `FeedSettledDocument`, and it is built on every pass the table applies,
/// so every field in it is a fact somebody already holds. A per-row standing is NOT one: working
/// out whether a row draws its Turn's copy chip is a walk down to the end of its Turn
/// (`FeedCopy.drawsChip(of:at:)`), and 4 800 of those on a seam-drag frame is the cost this design
/// exists to have removed. So the standings are DERIVED, one row at a time, by the pass that
/// actually measures — and the two sets they are derived from are what a stamp carries.
struct FeedMeasureStamp: Equatable, Sendable {
    /// The table's own width. The measure the rows wrap across is derived from it
    /// (`FeedRowMeasure.measure(atWidth:)`); the width itself is kept because that is what a table
    /// reports and what a resize changes.
    let width: CGFloat
    /// The two facts that re-ink the whole reading — see `FeedCellEnvironment.Ink`.
    let ink: FeedCellEnvironment.Ink
    let rows: [FeedRow]
    /// What the READER has done to the reading — one value, because both of its halves are the
    /// same kind of fact and a stamp is built on every pass the table applies
    /// (`FeedReaderStanding`).
    let reader: FeedReaderStanding

    /// The column the rows' own words wrap across at this width.
    var measure: CGFloat {
        FeedRowMeasure.measure(atWidth: width)
    }

    /// How the row at `index` stands — the three facts beyond its own words that decide its height.
    func standing(at index: Int) -> FeedRowStanding {
        guard rows.indices.contains(index) else { return FeedRowStanding() }
        let row = rows[index]
        return FeedRowStanding(
            drawsChip: FeedCopy.drawsChip(of: rows, at: index),
            isUnfolded: reader.unfolded.contains(row.id),
            isOpen: reader.open == row.id,
        )
    }

    /// Whether a document taken against `other` would have to be thrown away whole. Only the
    /// pass-wide facts are here: a row that changed is one row to re-measure, and a re-wrap is the
    /// document — the difference `FeedMeasureDelta` is built on.
    /// The MEASURE and not the width, because the measure is what a height is a function of
    /// (#1132). `ArgoFeedRow.column` caps it, so every width at or above the column wraps the
    /// reading identically and a table resized between two of them owes nothing.
    ///
    /// It used to compare the width. A tile cascade putting the table through 1023 → 766 → 1023 →
    /// 766 — all of which measure 672 — was four whole-document passes over 3 349 rows for no
    /// height at all, each cancelling the last, leaving the feed with no settled document for as
    /// long as they ran. Every seam drag on a deck wider than the column did the same, quietly.
    func rewraps(against other: FeedMeasureStamp?) -> Bool {
        guard let other else { return true }
        return measure != other.measure || ink != other.ink
    }

    /// Whether the two stamps are of the same reading, whatever else moved. What lets a width
    /// change keep the old document on screen, clipped, instead of blanking the deck on a drag
    /// frame.
    func isReading(of other: FeedMeasureStamp) -> Bool {
        rows.isSameReading(as: other.rows)
    }

    /// Whether the document taken against THIS stamp still stands under `other`: the same reading,
    /// or that reading grown at its tail (#1132).
    ///
    /// The grown half is what a live Session needs. `isReading` is exact, and a Session that is
    /// running is never exactly what it was — it gains rows, and it rewrites its last one as a call
    /// is answered. So the document that stands was surrendered on every re-wrap of every live
    /// reading, which is precisely the readings a reader is watching.
    ///
    /// And a surrender is not just a measure: `surrenderDocument` empties `shown`, `anchor()` reads
    /// `shown`, so the anchor comes back nil and `show()` takes the branch it takes for a reading
    /// nobody has opened — the tail. The reader is thrown to the end of the session for a width
    /// change. Growth at the tail cannot move a row already measured, so the standing document is
    /// still true of every row it has, and keeping it keeps the reader's place.
    func stands(under other: FeedMeasureStamp) -> Bool {
        isReading(of: other) || other.rows.extends(rows)
    }
}

extension FeedMeasureStamp {
    /// The stamp a model stands at, at the width its table is drawn at.
    @MainActor init(of model: FeedTableModel, atWidth width: CGFloat) {
        self.init(
            width: width,
            ink: model.environment.ink,
            rows: model.rows,
            reader: FeedReaderStanding(
                unfolded: model.unfolded.wrappedValue,
                open: model.selection.open,
            ),
        )
    }
}
