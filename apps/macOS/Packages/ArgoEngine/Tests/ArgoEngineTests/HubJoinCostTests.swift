@testable import ArgoEngine
import Testing

/// What a Session's OWN batch costs, which is the largest single cost the cockpit had (ADR-0028's
/// table, item 1). Three agents write to their own transcripts continuously, and every batch used
/// to take the whole chain graph and refold every row on the roster.
///
/// Asserted as a COUNT of rebuilds and never in seconds, which is ADR-0028 Rule 8's first
/// instruction: a count is EXACTLY the same idle and loaded where thread CPU is only approximately
/// so. What the CPU quotient here could not be held to, and why, is that ADR's #1064 amendment.
@Suite("Hub join cost")
struct HubJoinCostTests {
    /// The claim: what a content batch costs is what the BATCH is, not what the roster is. A batch
    /// written through the roster in place rebuilds nothing at all, so the count is zero at four
    /// rows and zero at two hundred. Restoring `rebuild()` on this path makes it one per batch at
    /// both.
    ///
    /// The count and the readings it replaced are `PerfBudgets.batchRebuilds` (#953, #1064), with
    /// every other recorded figure in this package.
    @Test
    func `a Session's own batch does not rebuild the join as the roster grows`() {
        var small = Self.settledRoster(of: 4)
        var large = Self.settledRoster(of: 200)
        // Settling a roster DOES rebuild, once per row, so a zero below is a batch path that
        // rebuilds nothing rather than a counter nothing ever bumped.
        #expect(small.rebuilds == 4)
        #expect(large.rebuilds == 200)

        let overFourRows = Self.rebuildsOfBatches(against: &small)
        let overTwoHundredRows = Self.rebuildsOfBatches(against: &large)

        // A batch for a transcript the join does not hold applies nothing and rebuilds nothing, so
        // the events landing is what stops an id that drifted from reading as a green zero.
        #expect(small.eventsHeld()["session-0"] == Self.backfill * 3 + Self.batches * 2)
        #expect(overFourRows == PerfBudgets.batchRebuilds)
        #expect(overTwoHundredRows == overFourRows)
    }

    /// Enough batches that a per-batch rebuild is unmistakable, and few enough that the Session
    /// under them stays the length a real one is: every batch appends.
    private static let batches = 500
    /// Enough of a reading behind each row that a refold has something to copy: the old cost was a
    /// new chain graph over every transcript, and a roster of empty Sessions hides that.
    private static let backfill = 30

    private static func settledRoster(of count: Int) -> HubJoin {
        var join = HubJoin()
        for index in 0 ..< count {
            join.add(hubTestObservation(id: "session-\(index)", events: []))
        }
        for index in 0 ..< count {
            join.apply(read(from: index), to: "session-\(index)")
        }
        return join
    }

    /// A backfill of the shape a real one has: identities, prose and times, and nothing that names
    /// another transcript — this is a roster of Sessions that resume nothing.
    private static func read(from index: Int) -> [TranscriptEvent] {
        (0 ..< backfill).flatMap { record in
            [
                TranscriptEvent.recordIdentity(uuid: "session-\(index)-record-\(record)"),
                .message(markdown: "record \(record) of session \(index)"),
                .prompt(text: "asked \(record)", images: [], atMs: index * 1000 + record),
            ]
        }
    }

    /// The batch a tail actually delivers between two writes: one record's worth of identity, prose
    /// and time. Always against the same transcript, so what the arms differ by is the ROSTER.
    private static func rebuildsOfBatches(against join: inout HubJoin) -> Int {
        let batch: [TranscriptEvent] = [
            .recordIdentity(uuid: "session-0-live"),
            .message(markdown: "said"),
        ]
        let before = join.rebuilds
        for _ in 0 ..< batches {
            join.apply(batch, to: "session-0")
        }
        return join.rebuilds - before
    }
}
