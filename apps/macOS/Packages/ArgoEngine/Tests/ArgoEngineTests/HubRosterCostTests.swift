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
/// Recorded on an M4 MacBook Pro, `swift test` debug, over 32 observed Sessions: one fold 98 µs,
/// one memoised read 0.56 µs, one `session(id:)` 0.68 µs at both 8 rows and 64. Before the memo a
/// read cost 75 µs and a `session(id:)` cost 18 µs at 8 rows and 163 µs at 64.
///
/// Every budget below is a RATIO of two figures taken on the same machine in the same run, so
/// none of them carries those numbers (ADR-0028 Rule 7): a seconds literal would record the laptop
/// it was written on, and would go green through a twentyfold regression on a faster one.
@Suite("Hub roster cost")
@MainActor
struct HubRosterCostTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-roster-cost")

    @Test
    func `a read with nothing moving costs a hundredth of a fold`() async {
        let hub = await Self.hub(sessions: 32)
        // The mutation is what makes each trial COLD, and it is what a fold costs that is being
        // measured: bumping one claim is orders of magnitude below the fold beside it.
        let fold = CostMeasure.leastCPUSeconds {
            hub.claims.setLostTurn(nil, for: Self.probe)
            _ = hub.sessions
        }
        _ = hub.sessions

        let read = CostMeasure.leastCPUSeconds {
            for _ in 0 ..< 200 {
                _ = hub.sessions
            }
        } / 200

        // A read with nothing moving is the stamp and nothing else: under a hundredth of a fold.
        #expect(read < fold / 100)
    }

    @Test
    func `one Session by id costs the same whatever the roster holds`() async {
        let small = await Self.hub(sessions: 8)
        let large = await Self.hub(sessions: 64)
        let wanted = "cost-7"

        let overEight = Self.lookups(of: wanted, in: small)
        let overSixtyFour = Self.lookups(of: wanted, in: large)

        #expect(small.session(id: wanted) != nil)
        #expect(large.session(id: wanted) != nil)
        // Rule 3's ratio: an eightfold roster may not cost more than 1.3x to look one row up in.
        #expect(overSixtyFour < overEight * 1.3)
    }

    private static let probe = SessionOwnership.ClaimID(value: "roster-cost-probe")

    private static func lookups(of id: String, in hub: Hub) -> Double {
        _ = hub.sessions
        return CostMeasure.leastCPUSeconds {
            for _ in 0 ..< 500 {
                _ = hub.session(id: id)
            }
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
