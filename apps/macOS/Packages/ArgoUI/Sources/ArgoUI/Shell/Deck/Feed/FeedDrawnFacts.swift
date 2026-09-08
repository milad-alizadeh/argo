import Foundation

/// What the visible cells were last drawn against: everything a cell renders that is not the
/// document's rows.
///
/// One value rather than four properties beside each other, because the compare and the write-back
/// are the same list read twice and nothing links them. A fifth fact added to one and not the other
/// leaves every pass stale, which is the defect #1646 was.
struct FeedDrawnFacts {
    var open: FeedRow.ID?
    /// Which step inside the open row — see `FeedRowSelection.step`. The highlight in a folded
    /// row's list is read off it, and the panel moves it as the reader scrolls (#1646).
    var step: Int?
    /// See `FeedTableModel.washed`.
    var washed: FeedRow.ID?
    var folds: Set<FeedRow.ID> = []

    init(
        open: FeedRow.ID? = nil,
        step: Int? = nil,
        washed: FeedRow.ID? = nil,
        folds: Set<FeedRow.ID> = [],
    ) {
        self.open = open
        self.step = step
        self.washed = washed
        self.folds = folds
    }

    @MainActor init(_ model: FeedTableModel) {
        self.open = model.selection.open
        self.step = model.selection.step
        self.washed = model.washed
        self.folds = model.unfolded.wrappedValue
    }

    /// The rows drawn against these facts that `fresh` leaves stale — what `refresh(rows:)` is
    /// owed once the environment has been dealt with.
    ///
    /// A row's id IS its position, assigned as one by `FeedProjection.rows`. The step travels with
    /// the open row because that is the only row which draws one (`FeedRowView.opening`), so a
    /// step that moved on its own leaves exactly that row stale.
    func stale(against fresh: Self) -> IndexSet {
        var rows = IndexSet()
        if fresh.open != open || fresh.step != step {
            rows.formUnion(IndexSet([open, fresh.open].compactMap(\.self)))
        }
        if fresh.folds != folds {
            rows.formUnion(IndexSet(folds.symmetricDifference(fresh.folds)))
        }
        if fresh.washed != washed {
            rows.formUnion(IndexSet([washed, fresh.washed].compactMap(\.self)))
        }
        return rows
    }
}
