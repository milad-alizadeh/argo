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
    func `a 304 on a branch keeps the Delivery the ledger holds`() async {
        // The read made conditional is the one whose answer is "nobody opened a pull request on
        // this branch", so what a `304` keeps is that: the branch is still a Delivery at its
        // commits, and not one that fell out of the room on the tick that saved a request.
        let held = Delivery(branch: "spike/idea", pullRequest: nil)
        let port = ScriptedCodeHost(
            [.success([])],
            unchanged: .init(branches: ["spike/idea"]),
        )

        let derived = await Self.derived(
            port: port, holding: [held], workspaces: [.on("spike/idea")],
        )

        #expect(derived.map(\.branch) == ["spike/idea"])
        #expect(derived.first?.stage == .commits)
    }

    @Test
    func `a branch the ledger holds nothing for is asked outright`() async {
        // The validator outlives the ledger entry: the ledger is replaced whole on every
        // derivation, so a tick whose Workspaces came back empty drops a branch the transport still
        // holds an ETag for. Asked conditionally, that branch would answer `304`, resolve to "no
        // pull request", and then keep answering `304` — the bare Delivery it just wrote holds no
        // pull request either, so nothing would ever ask outright again.
        let found = Delivery(branch: "argo/#1620-etags", pullRequest: .stub(number: 42))
        let port = ScriptedCodeHost(
            [.success([])],
            byBranch: ["argo/#1620-etags": found],
        )

        let derived = await Self.derived(
            port: port, holding: [], workspaces: [.on("argo/#1620-etags")],
        )

        #expect(await port.askedConditionally("argo/#1620-etags") == false)
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
    func `a 304 on the listing keeps the room rather than emptying it`() async {
        // The listing is only ever asked conditionally when nothing open is held, so a `304` says
        // the open set is still empty — and NOT that the derivation is. Read as an empty read it
        // would take the settled branch with it and stop the fan-out from ever reaching the bare
        // one, which is a strip that goes blank on the tick that saved a request.
        let settled = Delivery(branch: "argo/#1559-roster", pullRequest: .merged(number: 3))
        let port = ScriptedCodeHost([.success([])], unchanged: .init(listings: [1]))

        let derived = await Self.derived(
            port: port,
            holding: [settled],
            workspaces: [.on("argo/#1559-roster"), .on("spike/idea")],
        )

        #expect(derived.map(\.branch).sorted() == ["argo/#1559-roster", "spike/idea"])
    }

    @Test
    func `an empty listing leaves a teammate's Delivery to the ledger`() async {
        // Where the two outcomes are NOT told apart, and deliberately: since #1617 the ledger keeps
        // every branch a derivation did not reach, so an empty listing and a `304` leave the same
        // set behind. That is the ledger's rule and not this ticket's, and it is written down here
        // so the difference is looked for where it exists — on the per-branch read above, which
        // reaches its branch and so can overwrite it.
        let theirs = Delivery(branch: "them/#1601-roster", pullRequest: .stub(number: 9))
        let port = ScriptedCodeHost([.success([])])

        let derived = await Self.derived(port: port, holding: [theirs], workspaces: [])

        #expect(derived.map(\.branch) == ["them/#1601-roster"])
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
}
