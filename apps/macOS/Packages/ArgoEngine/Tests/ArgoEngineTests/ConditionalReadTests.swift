@testable import ArgoEngine
import Foundation
import Testing

/// The third outcome: the host's word that what the reader holds is still current (#1620).
///
/// Every case here presses on the same distinction. A `304` and an empty answer arrive through the
/// same read and mean opposite things — "the pull request you found is still there" against "nobody
/// has opened one" — and read as one, a tick that saved a request erases the mark the last tick
/// paid for.
@Suite("Conditional reads")
struct ConditionalReadTests {
    /// One open pull request, and the empty check-run and review pages every live one is then
    /// asked for.
    private static let onePull = [
        "/pulls?": PullRequestJSON.list([PullRequestJSON(number: 8)]),
        "check-runs": CheckRunJSON.page([]),
        "reviews": ReviewRoundJSON.list([]),
    ]
    private static let target = PortReadTarget.codeHost()

    private static func derived(
        port: ScriptedCodeHost, holding held: [Delivery], workspaces: [WorkspaceProjection],
    ) async
        -> [Delivery] {
        let ledger = DeliveryLedger()
        await ledger.record(held, for: "P1")
        let derivation = DeliveryDerivation(
            port: port, health: ConnectionHealthLedger(), deliveries: ledger,
        )
        await derivation.derive(
            target, locally: DeliveryDerivation.Locally(workspaces: workspaces),
        )
        return await ledger.deliveries(of: "P1")
    }

    // MARK: - The per-branch read

    @Test
    func `a 304 on a branch keeps the pull request the last tick found`() async {
        let held = Delivery(branch: "argo/#1620-etags", pullRequest: .stub(number: 42))
        let port = ScriptedCodeHost(
            [.success([])],
            unchanged: .init(branches: ["argo/#1620-etags"]),
        )

        let derived = await Self.derived(
            port: port, holding: [held], workspaces: [.on("argo/#1620-etags")],
        )

        #expect(derived.first?.pullRequest?.number == 42)
    }

    @Test
    func `a branch the host answers nothing for loses the pull request it held`() async {
        // The case a `304` must not be confused with: this is the host ANSWERING, and answering
        // that there is nothing on this branch — a pull request deleted, or a branch re-cut.
        let held = Delivery(branch: "argo/#1620-etags", pullRequest: .stub(number: 42))
        let port = ScriptedCodeHost([.success([])])

        let derived = await Self.derived(
            port: port, holding: [held], workspaces: [.on("argo/#1620-etags")],
        )

        #expect(derived.first?.pullRequest == nil)
        #expect(derived.first?.stage == .commits)
    }

    @Test
    func `only a branch with no pull request to keep fresh is asked conditionally`() async {
        // A branch holding a LIVE pull request is asked outright: its checks and its reviews move
        // without its own body moving, so a `304` about it would freeze the CI a person is
        // watching.
        let bare = Delivery(branch: "spike/idea", pullRequest: nil)
        let live = Delivery(branch: "argo/#1620-etags", pullRequest: .stub(number: 42))
        let port = ScriptedCodeHost([.success([])])

        _ = await Self.derived(
            port: port,
            holding: [bare, live],
            workspaces: [.on("spike/idea"), .on("argo/#1620-etags")],
        )

        #expect(await port.askedConditionally("spike/idea") == true)
        #expect(await port.askedConditionally("argo/#1620-etags") == false)
    }

    // MARK: - The listing

    @Test
    func `a 304 on the listing keeps what was listed rather than emptying the room`() async {
        // A teammate's pull request lives ONLY in the listing — this machine has no branch for it,
        // so nothing in the fan-out below would put it back.
        let theirs = Delivery(branch: "them/#1601-roster", pullRequest: .stub(number: 9))
        let port = ScriptedCodeHost([.success([])], unchanged: .init(listings: [1]))

        let derived = await Self.derived(port: port, holding: [theirs], workspaces: [])

        #expect(derived.map(\.branch) == ["them/#1601-roster"])
    }

    @Test
    func `an empty listing drops a pull request nothing local holds`() async {
        // The same read ANSWERING nothing: the pull request closed and no branch here is on it.
        let theirs = Delivery(branch: "them/#1601-roster", pullRequest: .stub(number: 9))
        let port = ScriptedCodeHost([.success([])])

        let derived = await Self.derived(port: port, holding: [theirs], workspaces: [])

        #expect(derived.isEmpty)
    }

    @Test
    func `the listing is asked outright while an open pull request is held`() async {
        let live = Delivery(branch: "argo/#1620-etags", pullRequest: .stub(number: 42))
        let port = ScriptedCodeHost([.success([live])])

        _ = await Self.derived(port: port, holding: [live], workspaces: [])

        #expect(await port.conditionalListing() == [false])
    }

    @Test
    func `the listing is asked conditionally when nothing open is held`() async {
        let port = ScriptedCodeHost([.success([])])

        _ = await Self.derived(port: port, holding: [], workspaces: [])

        #expect(await port.conditionalListing() == [true])
    }

    // MARK: - The code host adapter

    @Test
    func `a validated listing reaches the caller as unchanged and not as empty`() async throws {
        let api = RecordedGitHub(
            replies: Self.onePull, validating: ["/pulls?"],
        )
        let host = GitHubDeliveries(transport: api)

        let first = try await host.inFlight(in: "acme/api", grant: .listing, revalidating: true)
        let second = try await host.inFlight(in: "acme/api", grant: .listing, revalidating: true)

        #expect(first.answer?.count == 1)
        #expect(second.answer == nil)
    }

    @Test
    func `a listing asked outright is never answered unchanged`() async throws {
        let api = RecordedGitHub(
            replies: Self.onePull, validating: ["/pulls?"],
        )
        let host = GitHubDeliveries(transport: api)

        _ = try await host.inFlight(in: "acme/api", grant: .listing, revalidating: false)
        let again = try await host.inFlight(in: "acme/api", grant: .listing, revalidating: false)

        #expect(again.answer?.count == 1)
        #expect(await api.conditional().isEmpty)
    }

    // MARK: - Paging

    @Test
    func `a one-page listing that has not moved costs one request`() async throws {
        // The walk ends where the last one did rather than probing the page after it — otherwise a
        // saved request is spent again on an empty answer, and the ticket buys nothing (#1620).
        let api = RecordedGitHub(
            replies: Self.onePull, validating: ["/pulls?"],
        )
        let reads = GitHubReads(transport: api)

        _ = try await reads.pages(
            [GitHubPullRequest].self, of: "/repos/acme/api/pulls?state=open",
            grant: .listing, revalidating: true,
        )
        let before = await api.urls().count
        let again = try await reads.pages(
            [GitHubPullRequest].self, of: "/repos/acme/api/pulls?state=open",
            grant: .listing, revalidating: true,
        )

        #expect(again.answer == nil)
        #expect(await api.urls().count == before + 1)
    }

    @Test
    func `a walk whose pages disagree is read again for its bodies`() async throws {
        // A `304` leaves no items to splice into the gap, so a listing that moved on ONE of its
        // pages cannot be assembled from a mixed walk. It costs what it cost before this ticket.
        let api = RecordedGitHub(
            replies: [
                "&page=1": PullRequestJSON.list((1 ... 100).map { PullRequestJSON(number: $0) }),
                "&page=2": PullRequestJSON.list([PullRequestJSON(number: 101)]),
            ],
            validating: ["&page=2"],
        )
        let reads = GitHubReads(transport: api)
        let path = "/repos/acme/api/pulls?state=open"

        _ = try await reads.pages(
            [GitHubPullRequest].self, of: path, grant: .listing, revalidating: true,
        )
        let read = try await reads.pages(
            [GitHubPullRequest].self, of: path, grant: .listing, revalidating: true,
        )

        #expect(read.answer?.count == 101)
    }
}
