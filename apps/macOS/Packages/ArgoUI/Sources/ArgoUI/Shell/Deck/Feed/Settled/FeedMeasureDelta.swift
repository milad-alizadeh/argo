import Foundation

/// What a fresh stamp owes the settled document that stands: nothing, some rows, or the lot.
///
/// ADR-0030 Rule 5 is this type. A settled document changes in exactly two ways — rows appended at
/// the tail, and one row whose Result arrived and changed its height — and both are `rows`.
/// `whole` is the re-wrap: another width or another ink, where not one height taken against the old
/// stamp is true of the new one.
enum FeedMeasureDelta: Equatable {
    /// The document that stands is still a document of this stamp.
    case settled
    /// Every row, because nothing measured against the old stamp is true of this one.
    case whole
    /// The rows named, and no others.
    case rows(IndexSet)

    /// What `fresh` owes `settled`.
    ///
    /// The equality is asked first and is the ordinary answer: `apply` runs on every invalidation
    /// of the view above it — every frame of a seam drag included — and two passes over an
    /// unchanged reading share the rows' buffer, where `==` is a pointer comparison. Only a stamp
    /// that really moved pays for the walk below.
    static func between(_ settled: FeedSettledDocument?, and fresh: FeedMeasureStamp)
        -> FeedMeasureDelta {
        guard let stale = settled?.stamp, !fresh.rewraps(against: stale) else { return .whole }
        let unequal = DeckProbe.time("FeedMeasureDelta.between", rows: fresh.rows.count) {
            stale != fresh
        }
        guard unequal else { return .settled }
        let owed = owing(from: stale, to: fresh)
        // A reading that SHRANK — a compaction, a Session with less in it than the last — owes no
        // measurement at all where its surviving rows are unchanged, and is still not the document
        // that stands: the rows it no longer has have to go. `rows` with nothing named is what
        // lands that, because dropping them is `FeedSettledDocument.replacing` doing arithmetic on
        // an array rather than anything a pass has to measure.
        guard owed.isEmpty, stale.rows.count == fresh.rows.count else { return .rows(owed) }
        return .settled
    }

    /// Every row of `fresh` whose height cannot be the one taken against `stale`.
    ///
    /// Four things put a row in here:
    ///
    /// - a row `stale` does not have, which is the tail a live Session grew;
    /// - a row whose own content changed, which is the Result a live transcript rewrites its last
    ///   row with — and, across a room switch, whatever the reading re-projected while nobody was
    ///   watching;
    /// - a row whose predecessor changed KIND, because `FeedRow.step(to:from:)` puts the gap ABOVE
    ///   a row inside that row's height and the gap is the pair's own fact. The predecessor's
    ///   WORDS are not in it: a row above that grew a line moves nothing about the row below it;
    /// - a row the reader folded, let out, or opened the evidence panel on.
    private static func owing(
        from stale: FeedMeasureStamp,
        to fresh: FeedMeasureStamp,
    )
        -> IndexSet {
        var owed = IndexSet()
        for index in fresh.rows.indices {
            guard index < stale.rows.count else {
                owed.insert(index)
                continue
            }
            if fresh.rows[index] != stale.rows[index] {
                owed.insert(index)
            }
            if index > 0, stale.rows[index - 1].kind.isCall != fresh.rows[index - 1].kind.isCall {
                owed.insert(index)
            }
        }
        let folds = stale.reader.unfolded.symmetricDifference(fresh.reader.unfolded)
        owed.formUnion(IndexSet(folds))
        if stale.reader.open != fresh.reader.open {
            owed.formUnion(IndexSet([stale.reader.open, fresh.reader.open].compactMap(\.self)))
        }
        owed.formUnion(chipMoved(from: stale.rows, to: fresh.rows))
        return owed.filteredIndexSet { fresh.rows.indices.contains($0) }
    }

    /// The Turn's copy chip, which only the reading's LAST message can gain or lose: every chip
    /// above it is inside a Turn an arrival cannot reach. Two rows on the passes that move it and
    /// nothing at all on every other — see `FeedTableDelta.chipRow`, which reads the same rule.
    private static func chipMoved(from stale: [FeedRow], to fresh: [FeedRow]) -> IndexSet {
        let moved = chipRow(fresh)
        let stood = chipRow(stale)
        guard moved != stood else { return IndexSet() }
        return IndexSet([stood, moved].compactMap(\.self))
    }

    private static func chipRow(_ rows: [FeedRow]) -> Int? {
        rows.lastIndex { $0.kind.isMessage }
    }
}
