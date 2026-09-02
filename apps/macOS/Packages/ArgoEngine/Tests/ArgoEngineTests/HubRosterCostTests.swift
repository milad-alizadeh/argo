@testable import ArgoEngine
import Foundation
import Testing

/// What reading the roster COSTS (ADR-0028 Rule 1 and Rule 7).
///
/// `Hub.sessions` folds every observed transcript, decorates each row with four lookups taken
/// outside the transcript, and sorts the result. That is honest work for a roster that MOVED, and
/// pure waste for one that did not — and it was being paid per scene pass, per drive poll, and once
/// per Session inside the liveness poll's own callback.
///
/// The figures — the fold, the memoised read, and one `session(id:)` at two roster lengths — are
/// `PerfBudgets.rosterLookupFlat`, with every other recorded figure in this package (#953).
///
/// What binds here is a COUNT of folds and a RATIO of two figures taken on the same machine in the
/// same run (ADR-0028 Rule 7 and Rule 8): a seconds literal would record the laptop it was written
/// on, and would go green through a twentyfold regression on a faster one.
@Suite("Hub roster cost")
@MainActor
struct HubRosterCostTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-roster-cost")

    /// The COUNT rather than the quotient the seconds above make (ADR-0028 Rule 8): a fold is 32
    /// whole Sessions decorated and sorted, a read with nothing moving is one stamp compare, and
    /// two unlike halves can move by 3.8x on the machine alone.
    @Test
    func `a read with nothing moving folds nothing`() async {
        let hub = await Self.hub(sessions: 32)
        _ = hub.sessions
        let folded = hub.roster.folds

        for _ in 0 ..< 200 {
            _ = hub.sessions
        }
        // The stamp MOVING still folds, so the count is a memo and not a frozen roster. A fact
        // that moves, since #858: a claim republished with what it already held publishes nothing.
        hub.claims.setLostTurn("a Turn nobody heard", for: Self.probe)
        _ = hub.sessions

        #expect(hub.roster.folds == folded + 1)
    }

    /// The arms are `lookups` deep and INTERLEAVED, which is what makes the quotient readable at
    /// all. At 500 lookups each arm was ~0.35 ms here and the ratio 1.00, while the CI runner —
    /// where every other suite is on the box at once — read the same flat lookup as 1.89 and failed
    /// (#1005). A tenth-millisecond arm is a cache-contention reading with a lookup somewhere in
    /// it; a ~15 ms one is the lookup, and each pair rides the runner's drift together.
    @Test
    func `one Session by id costs the same whatever the roster holds`() async {
        let small = await Self.hub(sessions: 8)
        let large = await Self.hub(sessions: 64)
        let wanted = "cost-7"
        _ = small.sessions
        _ = large.sessions

        func overEightRows() {
            Self.lookUp(wanted, in: small)
        }
        func overSixtyFourRows() {
            Self.lookUp(wanted, in: large)
        }

        let trials = pairedCPUSeconds(overEightRows, against: overSixtyFourRows)
        let overEight = trials.map(\.first).min() ?? 0
        let overSixtyFour = trials.map(\.second).min() ?? 0

        #expect(small.session(id: wanted) != nil)
        #expect(large.session(id: wanted) != nil)
        // Rule 3's ratio: an eightfold roster may cost the slack and no more to look one row up
        // in, where walking it cost nine times.
        #expect(
            overSixtyFour < overEight * PerfBudgets.rosterLookupFlat,
            "eight rows \(overEight)s, sixty-four \(overSixtyFour)s, over \(trials.count) pairs",
        )
    }

    private static let probe = SessionOwnership.ClaimID(value: "roster-cost-probe")

    /// Deep enough that the reading is the lookup rather than the machine — see the case above.
    private static let lookups = 20000

    private static func lookUp(_ id: String, in hub: Hub) {
        for _ in 0 ..< lookups {
            _ = hub.session(id: id)
        }
    }

    /// A roster of observed Sessions, each in its own folder so the per-row lookups the fold takes
    /// outside the transcript all have something to answer.
    private static func hub(sessions: Int) async -> Hub {
        let hub = testHub(projectURL: projectURL)
        for index in 0 ..< sessions {
            await hubObserveToEnd(hub, hubTestObservation(
                id: "cost-\(index)",
                events: [
                    .cwd("\(projectURL.path)/worktree-\(index)"),
                    .title("Session \(index)"),
                    .prompt(text: "Work", images: [], atMs: 1000 + index),
                ],
            ))
        }
        return hub
    }
}
