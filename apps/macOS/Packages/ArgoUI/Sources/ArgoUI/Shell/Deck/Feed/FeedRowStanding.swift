/// What a row's height depends on beyond the words it holds: the reader's own state, and the one
/// fact about the Turn around it.
///
/// Three booleans and not the model, because a height is asked for EVERY row of the document on
/// every whole-document walk — see `FeedGeometry`, which keeps the same split for the same reason.
struct FeedRowStanding: Equatable {
    /// Whether this row draws its Turn's copy chip, which is a fact about the whole Turn rather
    /// than about the row — see `FeedCopy.drawsChip(of:at:)`.
    var drawsChip = false
    /// Whether the reader has let this row's fold out. A prompt shows all of its lines and an
    /// unreadable run shows its raw text.
    var isUnfolded = false
    /// Whether this row is the one the evidence panel is open on, which is what makes a survey
    /// list what it looked at.
    var isOpen = false
}

extension FeedRowStanding {
    /// How the row at `index` stands in the model it is drawn from, so the list above cannot drift
    /// from what `FeedTableModel.content(at:)` actually reads.
    @MainActor init(at index: Int, of model: FeedTableModel) {
        let row = model.rows[index]
        self.init(
            drawsChip: FeedCopy.drawsChip(of: model.rows, at: index),
            isUnfolded: model.unfolded.wrappedValue.contains(row.id),
            isOpen: model.selection.open == row.id,
        )
    }
}
