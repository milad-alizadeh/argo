@testable import ArgoEngine
import Testing

/// What the OPENING fill costs — the window between the cockpit's window appearing and its roster
/// standing still, which is the one window the frame band was outside its budget in (#1556).
///
/// A sweep admits every transcript in the working set and then reads them, so each of them settles
/// under its own batch. Every settling batch moved the join's facts, so every one of them refolded
/// the whole chain graph and the whole roster: the fill was quadratic in the number of transcripts,
/// on the main actor, and a 95-row tree opened at 7 fps for fifteen seconds.
///
/// Asserted as a COUNT of folds and never in seconds, which is ADR-0028 Rule 8's first instruction.
@Suite("Hub join, opening fill cost")
struct HubJoinFillCostTests {
    /// The claim: what a fill costs is what the ROSTER is read, not what the fill is. Nothing reads
    /// the roster while the batches land, so the whole fill folds once — at four rows and at two
    /// hundred. Restoring the fold on the write side makes it one per batch at both.
    ///
    /// The count and what it replaced are `PerfBudgets.fillFolds`.
    @Test
    func `an opening fill folds for the read and not for the batches`() {
        var small = Self.fill(of: 4)
        var large = Self.fill(of: 200)

        // The read is what folds, so it comes before the count and the roster it answers with is
        // the proof the fold happened at all.
        #expect(small.sessions.count == 4)
        #expect(large.sessions.count == 200)
        #expect(small.rebuilds == PerfBudgets.fillFolds)
        #expect(large.rebuilds == small.rebuilds)
    }

    /// The other half of the same claim, so the count above cannot be read as a fold that stopped
    /// happening: a roster read BETWEEN two batches folds for each of them.
    @Test
    func `a roster read between two batches folds for each of them`() {
        var join = Self.fill(of: 4)
        let folded = join.sessions.count

        join.apply([.headLeaf(uuid: "row-0-record-0")], to: "row-1")
        _ = join.sessions
        join.apply([.headLeaf(uuid: "row-0-record-1")], to: "row-2")
        _ = join.sessions

        #expect(folded == 4)
        #expect(join.rebuilds == PerfBudgets.fillFolds + 2)
    }

    /// Enough of a reading behind each row that a fold has something to copy: the cost is a new
    /// chain graph over every transcript, and a set of empty Sessions hides that.
    private static let backfill = 30

    /// The shape the sweep leaves: every transcript admitted, then every one of them settled by the
    /// backfill its own tail delivers. Each row resumes nothing, so the fold is the plain one.
    private static func fill(of count: Int) -> HubJoin {
        var join = HubJoin()
        for index in 0 ..< count {
            join.add(hubTestObservation(id: "row-\(index)", events: []))
        }
        for index in 0 ..< count {
            join.apply(read(from: index), to: "row-\(index)")
        }
        return join
    }

    private static func read(from index: Int) -> [TranscriptEvent] {
        (0 ..< backfill).flatMap { record in
            [
                TranscriptEvent.recordIdentity(uuid: "row-\(index)-record-\(record)"),
                .message(markdown: "record \(record) of row \(index)"),
                .prompt(text: "asked \(record)", images: [], atMs: index * 1000 + record),
            ]
        }
    }
}
