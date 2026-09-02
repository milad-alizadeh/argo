import AppKit
import SwiftUI

/// Measured row heights for ONE reading, held above every view identity a switch destroys.
///
/// Which reading's heights these are is `FeedGeometries`', which holds one of these per
/// `FeedReading`.
///
/// A height is a full SwiftUI layout against the ruler — see `FeedTableCoordinator.measuredHeight`
/// — and `InstrumentDeckShell` draws each room in its own `switch` arm, so leaving the Sessions
/// room tears the table down and coming back measured every row again (#858).
///
/// Each height is kept with the whole of what it is a fact ABOUT, and answers only a question that
/// matches. That is the entire correctness of outliving the table: there is no invalidation to get
/// right and no order to get right, because a height that is no longer true of anything simply
/// stops being found.
///
/// What a height depends on splits in two, and so does this. The width and the ink are the same for
/// every row of a pass, so they are the store's and are checked once — `settle(at:in:)`. The row,
/// the row above it, its fold and whether it is open differ per row, and are the `Ground` that goes
/// in with each question. Keeping the pass facts out of `Ground` is not tidiness: `heightOfRow` is
/// asked for EVERY row each time the minimap re-reads the document, and a `FeedCellEnvironment`
/// carries a palette and two closures.
///
/// NOT `@Observable`. A height is written per measured row, and a view invalidated at that rate
/// would cost more than the measuring does.
@MainActor final class FeedGeometry {
    private var held: [Int: Held] = [:]
    private var width: CGFloat?
    private var ink: FeedCellEnvironment.Ink?
    /// Which row was drawing the Turn's copy chip when these heights were taken. The one thing a
    /// ground cannot see — a chip is a fact about the row's whole Turn — and the one row whose
    /// height changes without the row changing. Held HERE because it must survive the switch that
    /// the heights survive. See `FeedTableDelta.chipRow` and `surrenderMovedChip()`.
    var chipRow: Int?

    var count: Int {
        held.count
    }

    var isEmpty: Bool {
        held.isEmpty
    }

    /// The pass's own facts, checked once for the whole reading. A width or an ink nothing was
    /// measured under retires every height, because not one of them is true of it.
    func settle(at width: CGFloat, in ink: FeedCellEnvironment) {
        guard self.width != width || self.ink != ink.ink else { return }
        held.removeAll()
        self.width = width
        self.ink = ink.ink
    }

    func height(at index: Int, under ground: Ground) -> CGFloat? {
        guard let known = held[index], known.ground == ground else { return nil }
        return known.height
    }

    func record(_ height: CGFloat, at index: Int, under ground: Ground) {
        held[index] = Held(height: height, ground: ground)
    }

    /// Measured heights surrendered — all of them, or the rows named.
    func drop(_ rows: IndexSet? = nil) {
        guard let rows else { return held.removeAll() }
        for row in rows {
            held[row] = nil
        }
    }

    /// Every height for a row the reading no longer has. A reading that shrank — a compaction, a
    /// Session with less in it than the last — would otherwise leave an entry per lost index that
    /// no question can ever match again, held for the life of the window.
    func dropBeyond(_ count: Int) {
        held = held.filter { $0.key < count }
    }

    /// What one row's height is true of, beyond the pass it was measured in.
    ///
    /// The row itself, because its words are what wrapped. The row above it, because
    /// `FeedRow.step(to:from:)` puts the gap above a row INSIDE that row's height. Whether it is
    /// unfolded, because a folded prompt is three lines and an unfolded one is the whole of it.
    /// Whether it is the open row, because a survey draws a line per call when it is
    /// (`FeedSurveyLine`) and nothing when it is not.
    @MainActor struct Ground: Equatable {
        let row: FeedRow
        let above: FeedRow?
        let isUnfolded: Bool
        let isOpen: Bool

        /// Built from the model the row is drawn out of, so the list above cannot drift from what
        /// `FeedTableModel.content(at:)` actually reads.
        init(at index: Int, of model: FeedTableModel) {
            let row = model.rows[index]
            self.row = row
            self.above = index > 0 ? model.rows[index - 1] : nil
            self.isUnfolded = model.unfolded.wrappedValue.contains(row.id)
            self.isOpen = model.selection.open == row.id
        }
    }

    private struct Held {
        let height: CGFloat
        let ground: Ground
    }
}
