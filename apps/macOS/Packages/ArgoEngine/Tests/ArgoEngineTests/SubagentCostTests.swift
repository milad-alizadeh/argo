@testable import ArgoEngine
import Foundation
import Testing

/// ADR-0028 Rule 1 over the path a fan-out writes on: a Subagent's batch, and the reading it feeds,
/// fold the roster no times however many Sessions are on it.
///
/// This is the gate #858 moved rather than removed. The rule was written against
/// `HubJoin.apply(_:ofSubagent:to:)`, which rebuilt every Session and the whole chain graph for one
/// child's bytes; the readings live beside the roster now, so the count ought to be zero by
/// construction. That is exactly why it stays: "by construction" is what a future change quietly
/// undoes, and routing a child's batch back into the join is the regression this restructure makes
/// easy to write.
///
/// The count and the readings it replaced are `PerfBudgets.subagentReadingFolds` (ADR-0028 Rule 8,
/// and that ADR's #1064 and #1065 amendments for why the quotient could not be held to).
///
/// What the count does NOT see, stated because Rule 8 drops a claim rather than implying it: the
/// stamp is the only thing a fold can watch, and a READ does not move one. So the WRITE half is
/// held here — a batch back in the join moves `joinRevision` — and a `subagentReading(of:)`
/// re-implemented over `hub.sessions` would be a memo HIT, folding nothing and passing green while
/// costing the whole roster. The quotient covered that half; no count in the tree does.
@Suite("Subagent cost")
@MainActor
struct SubagentCostTests {
    @Test
    func `a Subagent's reading does not fold the roster as it grows`() async {
        let small = await Self.roster(of: 4)
        let large = await Self.roster(of: 200)
        // A counter nothing ever reached reads zero as well as a path that folds nothing, so each
        // roster is made to fold on demand first: the memo refolds when its stamp moves.
        #expect(Self.foldsOnAStampMove(of: small) == 1)
        #expect(Self.foldsOnAStampMove(of: large) == 1)

        let overFourRows = Self.foldsOfBatches(against: small)
        let overTwoHundredRows = Self.foldsOfBatches(against: large)

        // A reading answers nothing for an id or a path it does not hold, and a loop that reads
        // nothing folds nothing — so the events landing are what stops a fixture whose id or path
        // drifted from reading as a green zero.
        #expect(small.subagentReading(of: Self.agentID)?.count == Self.batches)
        #expect(large.subagentReading(of: Self.agentID)?.count == Self.batches)
        #expect(overFourRows == PerfBudgets.subagentReadingFolds)
        #expect(overTwoHundredRows == PerfBudgets.subagentReadingFolds)
    }

    /// Enough batches that a per-batch fold is unmistakable, and few enough that the reading under
    /// them stays the length a real one is: every batch appends.
    private static let batches = 2000
    private static let agentID = "measured"
    private static let file = "/tmp/argo-subagent-cost/measured.jsonl"
    private static let said = TranscriptEvent.message(markdown: "the child said")
    private static let probe = SessionOwnership.ClaimID(value: "subagent-cost-probe")

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

    /// The one fold a moved stamp costs, which is what proves the counter the case below reads is
    /// live rather than never reached.
    private static func foldsOnAStampMove(of hub: Hub) -> Int {
        _ = hub.sessions
        let before = hub.roster.folds
        hub.claims.setLostTurn(nil, for: probe)
        _ = hub.sessions
        return hub.roster.folds - before
    }

    /// What a batch folds from the tail's write to the lane's read. The write is the half a fold
    /// count can see, per the limit stated above.
    ///
    /// The roster is READ beside every batch because a fold is only ever paid on a read: a batch
    /// that republished the whole roster would cost nothing here until something looked at it, and
    /// the cockpit looks once per scene pass. So the count is what the app would actually pay.
    private static func foldsOfBatches(against hub: Hub) -> Int {
        let read = [said]
        _ = hub.sessions
        let before = hub.roster.folds
        for _ in 0 ..< batches {
            hub.subagents.apply(read, from: file)
            _ = hub.subagentReading(of: agentID)
            _ = hub.sessions
        }
        return hub.roster.folds - before
    }
}
