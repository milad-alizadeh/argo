import Foundation

// What one row's height is a fact ABOUT — the key `FeedGeometry` files every height under, kept in
// a file of its own because it is the whole of that store's correctness.

extension FeedGeometry {
    /// What one row's height is true of, beyond the pass it was measured in.
    ///
    /// The row's CONTENT and never its `id`, which is its index. The id says where the row sat, and
    /// a row that moved because a bounded excerpt grew into the whole file is the same row at the
    /// same height (`TranscriptExcerpt`).
    ///
    /// Everything a height can turn on is in here, and two grounds that compare equal are two rows
    /// that draw the same. The row itself, because its words are what wrapped. The row above it,
    /// because `FeedRow.step(to:from:)` puts the gap above a row INSIDE that row's height. Whether
    /// it is unfolded, because a folded prompt is three lines and an unfolded one is the whole of
    /// it. Whether it is the open row, because a survey draws a line per call when it is
    /// (`FeedSurveyLine`) and nothing when it is not. And whether it draws its Turn's copy chip —
    /// the one fact here that is about neither the row nor the row above: two rows saying the same
    /// words under the same row stand at different heights when one of them is the last message of
    /// its Turn and the other is not (`FeedCopy.drawsChip(of:at:)`).
    ///
    /// A key rather than a guard on a key, so two rows that draw differently CANNOT share an entry:
    /// `hash(into:)` only chooses the bucket, and `==` over every fact above is what answers.
    struct Ground: Hashable {
        let row: FeedRow.Content
        let above: FeedRow.Content?
        let isUnfolded: Bool
        let isOpen: Bool
        let drawsChip: Bool

        /// Built from the model the row is drawn out of, so the list above cannot drift from what
        /// `FeedTableModel.content(at:)` actually reads.
        @MainActor init(at index: Int, of model: FeedTableModel) {
            let row = model.rows[index]
            self.row = row.content
            self.above = index > 0 ? model.rows[index - 1].content : nil
            self.isUnfolded = model.unfolded.wrappedValue.contains(row.id)
            self.isOpen = model.selection.open == row.id
            self.drawsChip = FeedCopy.drawsChip(of: model.rows, at: index)
        }

        func hash(into hasher: inout Hasher) {
            hasher.combine(isUnfolded)
            hasher.combine(isOpen)
            hasher.combine(drawsChip)
            row.spread(into: &hasher)
            above?.spread(into: &hasher)
        }
    }
}
