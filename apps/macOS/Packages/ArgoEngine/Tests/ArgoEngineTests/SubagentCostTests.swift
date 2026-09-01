@testable import ArgoEngine
import Foundation
import Testing

/// ADR-0028 Rule 3 over the path a fan-out writes on: a Subagent's reading costs what it costs
/// however many Sessions are on the roster.
///
/// This is the gate #858 moved rather than removed. The rule was written against
/// `HubJoin.apply(_:ofSubagent:to:)`, which rebuilt every Session and the whole chain graph for one
/// child's bytes; the readings live beside the roster now, so the ratio ought to be 1 by
/// construction. That is exactly why it stays: "by construction" is what a future change quietly
/// undoes, and wiring the batch or the read back through the roster is the regression this
/// restructure makes easy to write.
///
/// The ratio and never the seconds (Rule 7), CPU rather than wall clock (`CostMeasure`), and the
/// arms interleaved so a machine that drifts mid-run drifts into both minima. It is the neighbour
/// of `HubJoinCostTests`, not a copy of it: that one holds the SESSION's own batch against the
/// join, and this one holds a child's batch against a path that no longer touches the join at all.
///
/// Recorded on this branch, rebased onto #1005, at 0.99, 1.00 and 0.99 over three runs of ten
/// trials each — debug, M-series laptop, other agents building. The 1.3 threshold is the one the
/// deleted gate carried, kept because what it has to catch has not changed: rebuilding the roster
/// per batch made the same ratio 37x.
@Suite("Subagent cost")
@MainActor
struct SubagentCostTests {
    @Test
    func `a Subagent's reading does not cost more as the roster grows`() async {
        let small = await Self.roster(of: 4)
        let large = await Self.roster(of: 200)
        let costs = (0 ..< Self.trials).map { _ in
            (small: Self.costOfBatches(against: small), large: Self.costOfBatches(against: large))
        }
        let ratio = (costs.map(\.large).min() ?? 0) / (costs.map(\.small).min() ?? 1)

        #expect(ratio < 1.3)
    }

    private static let batches = 2000
    /// A minimum converges on the intrinsic cost from above, so trials buy accuracy directly.
    private static let trials = 10
    private static let agentID = "measured"
    private static let file = "/tmp/argo-subagent-cost/measured.jsonl"
    private static let said = TranscriptEvent.message(markdown: "the child said")

    /// A Hub with `count` Sessions read and published, tailing one Subagent file.
    private static func roster(of count: Int) async -> Hub {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-subagent-cost"))
        for index in 0 ..< count {
            await hub.startObserving(
                hubTestObservation(id: "session-\(index)", events: [.title("Session \(index)")]),
            )
        }
        await hubSettle { hub.sessions.count == count }
        hub.subagents.beginReading(of: agentID, from: file)
        return hub
    }

    /// What a batch costs from the tail's write to the lane's read — both halves, because either
    /// one wired back through the roster is the regression this holds.
    private static func costOfBatches(against hub: Hub) -> Double {
        let read = [said]
        return cpuSeconds {
            for _ in 0 ..< batches {
                hub.subagents.apply(read, from: file)
                _ = hub.subagentReading(of: agentID)
            }
        }
    }
}
