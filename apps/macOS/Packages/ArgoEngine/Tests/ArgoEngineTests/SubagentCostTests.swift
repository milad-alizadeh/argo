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
/// undoes, and wiring the batch or the read back through the roster is the regression this
/// restructure makes easy to write.
///
/// Asserted as a COUNT of folds and never in seconds, which is ADR-0028 Rule 8's first instruction:
/// a count is EXACTLY the same idle and loaded where thread CPU is only approximately so. What the
/// CPU quotient here could not be held to, and why, is that ADR's #1064 and #1065 amendments; the
/// seconds it read are `PerfBudgets.subagentReadingFolds` and they bind nothing.
///
/// It is the neighbour of `HubJoinCostTests`, not a copy of it: that one counts what a SESSION's
/// own batch rebuilds inside the join, and this one counts what a CHILD's batch folds on a roster
/// the path no longer touches at all. The count is the roster's for that reason —
/// `HubRosterMemo.folds`, the same counter `HubRosterCostTests` gates on.
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
        // nothing folds nothing — so the events landing are what stops an id that drifted from the
        // one being tailed reading as a green zero.
        #expect(small.subagentReading(of: Self.agentID)?.count == Self.batches)
        #expect(large.subagentReading(of: Self.agentID)?.count == Self.batches)
        #expect(overFourRows == PerfBudgets.subagentReadingFolds)
        #expect(overTwoHundredRows == overFourRows)
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

    /// What a batch folds from the tail's write to the lane's read — both halves, because either
    /// one wired back through the roster is the regression this holds.
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
