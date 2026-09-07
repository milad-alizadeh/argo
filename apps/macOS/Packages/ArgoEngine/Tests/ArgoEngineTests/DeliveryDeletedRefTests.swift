@testable import ArgoEngine
import Testing

/// Deriving a Delivery for a branch the host has deleted (#1618, ADR-0032) — the state every
/// merged worktree on this checkout is in, and the one the ref filter alone cannot see.
///
/// Driven through the real `GitHubDeliveries` rather than the scripted host, because the fact
/// under test is what one branch's 422 does to the branches AFTER it, and only the adapter decides
/// that.
@Suite("Delivery deleted ref")
struct DeliveryDeletedRefTests {
    private static let merged = "argo/#1604-tick-cost"
    private static let unpushed = "argo/#1597-prose-ink"

    /// A host that answers no ref filter at all — every branch here is one whose head ref is gone.
    private static func afterEveryRefWasDeleted(
        _ commits: [String: String],
    )
        -> [String: String] {
        commits.merging([
            "/pulls?state=all": "[]",
            "check-runs": CheckRunJSON.page([]),
            "reviews": ReviewRoundJSON.list([]),
        ]) { own, _ in own }
    }

    private static func derived(
        _ replies: [String: String], on workspaces: [WorkspaceProjection],
    ) async
        -> DeliveryLedger {
        let ledger = DeliveryLedger()
        await DeliveryDerivation(
            port: GitHubDeliveries(transport: RecordedGitHub(replies: replies)),
            health: ConnectionHealthLedger(),
            deliveries: ledger,
        )
        .derive(.codeHost(), locally: .init(workspaces: workspaces))
        return ledger
    }

    /// The merged pull request the commit path answers with. `branch` is spelled because the
    /// Delivery is keyed on the head ref the HOST reports, which outlives the ref itself — GitHub
    /// keeps `head.ref` on a pull request whose branch it has deleted.
    private static let mergedPull = PullRequestJSON.list([
        PullRequestJSON(
            number: 1604, state: "closed", mergedAt: "2026-08-01T00:00:00Z", branch: merged,
        ),
    ])
    private static let noCommit = #"{ "message": "No commit found for SHA: aaa" }"#

    @Test
    func `a branch whose ref is gone derives the merged pull request at its head commit`() async {
        let ledger = await Self.derived(
            Self.afterEveryRefWasDeleted(["commits/bbb/pulls": Self.mergedPull]),
            on: [.on(Self.merged, headSha: "bbb")],
        )

        #expect(await ledger.delivery(ofBranch: Self.merged, in: "P1")?.stage == .merge)
    }

    /// Two branches whose refs are both gone: the first's commit answers `reply`, the second's
    /// answers the merged pull request. The fan-out asks them in that order, so whether the second
    /// derives at all is the whole of what the first's answer did to the read.
    private static func derivedPast(_ reply: String) async -> DeliveryLedger {
        await derived(
            afterEveryRefWasDeleted([
                "commits/aaa/pulls": reply,
                "commits/bbb/pulls": mergedPull,
            ]),
            on: [.on(unpushed, headSha: "aaa"), .on(merged, headSha: "bbb")],
        )
    }

    @Test
    func `a commit the host does not hold does not stop the branches after it`() async {
        // The 422 is a fact about one branch — a local tip nobody pushed — so it may not truncate
        // the fan-out. Left as a refusal, any one of this checkout's 15 unpushed branches would.
        let ledger = await Self.derivedPast(Self.noCommit)

        #expect(await ledger.delivery(ofBranch: Self.merged, in: "P1")?.stage == .merge)
        #expect(await ledger.delivery(ofBranch: Self.unpushed, in: "P1")?.pullRequest == nil)
    }

    @Test
    func `a refusal the commit path is not entitled to still stops the fan-out`() async {
        // Every other failure keeps the behaviour the fan-out was given deliberately: a host that
        // refused one branch is refusing the read, and the branches after it buy nothing.
        let ledger = await Self.derivedPast(#"{ "message": "Validation Failed" }"#)

        #expect(await ledger.delivery(ofBranch: Self.merged, in: "P1") == nil)
    }

    @Test
    func `a branch with no head commit read is asked about by name alone`() async {
        // A detached-HEAD-adjacent reading: git named the branch and no SHA, so there is nothing to
        // fall back to and the derivation is the same one it always was.
        let api = RecordedGitHub(replies: Self.afterEveryRefWasDeleted([:]))
        await DeliveryDerivation(
            port: GitHubDeliveries(transport: api),
            health: ConnectionHealthLedger(),
            deliveries: DeliveryLedger(),
        )
        .derive(.codeHost(), locally: .init(workspaces: [.on(Self.merged)]))
        let asked = await api.urls()

        #expect(!asked.contains { $0.contains("/commits/") })
    }

    @Test
    func `a live branch costs no commit query`() async {
        // The ref filter answered, so the second query is never asked and no live branch's cost
        // moves (#1588).
        let api = RecordedGitHub(replies: [
            "/pulls?state=all": PullRequestJSON.list([PullRequestJSON(number: 1618)]),
            "check-runs": CheckRunJSON.page([]),
            "reviews": ReviewRoundJSON.list([]),
        ])
        await DeliveryDerivation(
            port: GitHubDeliveries(transport: api),
            health: ConnectionHealthLedger(),
            deliveries: DeliveryLedger(),
        )
        .derive(.codeHost(), locally: .init(workspaces: [.on(Self.merged, headSha: "bbb")]))
        let asked = await api.urls()

        #expect(!asked.contains { $0.contains("/commits/bbb/pulls") })
    }
}
