@testable import ArgoEngine
import Foundation
import Testing

/// What a Session's OWN batch costs, which is the largest single cost the cockpit had (ADR-0028's
/// table, item 1). Three agents write to their own transcripts continuously, and every batch used
/// to take the whole chain graph and refold every row on the roster.
///
/// Asserted as a RATIO rather than in seconds (ADR-0028 Rule 3): a ratio survives a change of
/// machine and of build configuration, which is what makes it the only honest budget for a number
/// measured on a laptop.
@Suite("Hub join cost")
struct HubJoinCostTests {
    /// The claim: what a content batch costs is what the BATCH is, not what the roster is. The two
    /// arms differ by fifty times the sessions and fifty times the events already read, so a fold
    /// per batch shows up here as a ratio the size of the working set — restoring `rebuild()` on
    /// this path takes it to 36x.
    ///
    /// The threshold is ADR-0028 Rule 3's own 1.3, which this is the second path to carry. Recorded
    /// on an M-series laptop, debug configuration: six readings, three idle and three with ten
    /// spinners on the box, came out between 0.97 and 1.01 — never above 1.02, and no wider loaded
    /// than idle, which is what a thread-CPU clock buys. Each arm is 5.9 ms, so a scheduler
    /// artefact is a rounding error rather than a third of the reading. The figures live here until
    /// #953 gives the recorded ones one file.
    @Test
    func `a Session's own batch does not cost more as the roster grows`() {
        #expect(Self.costRatioOfBatches() < 1.3)
    }

    /// Enough batches that one arm is milliseconds rather than fractions of one, and few enough
    /// that the Session under them stays the length a real one is: every batch appends, so a run
    /// long enough to hide a scheduler artefact would end up measuring the growth instead.
    private static let batches = 500
    /// A minimum converges on the intrinsic cost from above, so trials buy accuracy directly.
    private static let trials = 15
    /// Enough of a reading behind each row that a refold has something to copy: the old cost was a
    /// new chain graph over every transcript, and a roster of empty Sessions hides that.
    private static let backfill = 30

    /// Measured turn by turn rather than one arm after the other: a laptop stepping its clock, or a
    /// CI box picking up a neighbour, drifts over the run and would otherwise land on whichever arm
    /// was in flight when it did. Interleaved, that drift is in both minima.
    private static func costRatioOfBatches() -> Double {
        var small = settledRoster(of: 4)
        var large = settledRoster(of: 200)
        let costs = (0 ..< trials).map { _ in
            (small: costOfBatches(against: &small), large: costOfBatches(against: &large))
        }
        return (costs.map(\.large).min() ?? 0) / (costs.map(\.small).min() ?? 1)
    }

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
    private static func costOfBatches(against join: inout HubJoin) -> Double {
        let batch: [TranscriptEvent] = [
            .recordIdentity(uuid: "session-0-live"),
            .message(markdown: "said"),
        ]
        let started = threadCPUSeconds()
        for _ in 0 ..< batches {
            join.apply(batch, to: "session-0")
        }
        return threadCPUSeconds() - started
    }
}
