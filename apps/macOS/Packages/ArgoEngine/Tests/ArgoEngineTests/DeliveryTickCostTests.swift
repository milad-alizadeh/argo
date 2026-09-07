@testable import ArgoEngine
import Testing

/// What a tick costs in REQUESTS, counted through `GitHubDeliveries` and the adapter's own paging
/// rather than through a fake port (#1619).
///
/// Shaped like this repository's own checkout at the time of the measurement: one open pull
/// request,
/// fifteen branches whose Delivery is finished, and the rest branches the host holds no pull
/// request
/// for. That last row was ~46 of a tick's 50 requests, and it is the one that grew with every
/// worktree the checkout collected.
@Suite("Delivery tick cost")
struct DeliveryTickCostTests {
    /// The measured checkout: 80 worktrees, which is what this one held when #1619 was written.
    private static let worktrees = 80
    private static let finished = 15

    /// One tick's cost per tick, in order, over ONE derivation — the second tick is the one the
    /// claim is about, and only a derivation that saw the first has anything to answer from.
    private static func spent(over worktrees: Int, ticks: Int) async -> [Int] {
        let checkout = Checkout(worktrees: worktrees)
        let host = CountingGitHub(open: checkout.open, byBranch: checkout.byBranch)
        let derivation = DeliveryDerivation(
            port: GitHubDeliveries(transport: host),
            health: ConnectionHealthLedger(),
            deliveries: DeliveryLedger(),
        )
        let locally = DeliveryDerivation.Locally(workspaces: checkout.workspaces)
        var costs: [Int] = []
        for _ in 1 ... ticks {
            await derivation.derive(.codeHost(), locally: locally)
            await costs.append(host.spent())
        }
        return costs
    }

    @Test
    func `a tick after the first costs the open listing and nothing per branch`() async {
        // 1 for the listing + 2 for the one open pull request's checks and reviews. Every other
        // branch is answered from what the last tick established.
        let costs = await Self.spent(over: Self.worktrees, ticks: 3)

        #expect(costs.dropFirst() == [3, 3])
    }

    @Test
    func `the first tick pays once per branch and no more`() async {
        // 3 for the open pull request, then one `head=` listing for each of the other 79 branches:
        // the finished ones buy their terminal answer, the rest buy "nothing here".
        let costs = await Self.spent(over: Self.worktrees, ticks: 1)

        #expect(costs == [3 + Self.worktrees - 1])
    }

    @Test
    func `a tick's cost stops growing with the number of worktrees`() async {
        // The acceptance criterion, as a suite: double the checkout and the steady-state tick is
        // the same number. Before this change it doubled with it.
        let doubled = await Self.spent(over: Self.worktrees * 2, ticks: 2)
        let measured = await Self.spent(over: Self.worktrees, ticks: 2)

        #expect(doubled.last == measured.last)
    }

    /// A checkout of `worktrees` branches: one with an open pull request, fifteen finished, the
    /// rest
    /// with none. Each branch sits at its own commit, as git's worktree listing answers them.
    private struct Checkout {
        let workspaces: [WorkspaceProjection]
        let open: [PullRequestJSON]
        let byBranch: [String: PullRequestJSON]

        init(worktrees: Int) {
            let live = "argo/#1541-open"
            let landed = (0 ..< DeliveryTickCostTests.finished).map { "argo/#\($0)-done" }
            let quiet = (0 ..< worktrees - 1 - landed.count).map { "argo/#\($0)-quiet" }
            let branches = [live] + landed + quiet
            self.workspaces = branches.map { .on($0, at: "sha-\($0)") }
            self.open = [PullRequestJSON(number: 1541, branch: live, headSHA: "sha-\(live)")]
            self.byBranch = landed.enumerated().reduce(into: [:]) { held, landed in
                held[landed.element] = PullRequestJSON(
                    number: landed.offset,
                    state: "closed",
                    mergedAt: "2026-08-01T00:00:00Z",
                    branch: landed.element,
                )
            }
        }
    }
}
