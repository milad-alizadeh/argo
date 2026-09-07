@testable import ArgoEngine
import Testing

/// What one tick spends (#1588) — the branches it stops asking about, and the ones it must keep
/// asking about.
///
/// Held apart from `DeliveryRefusalTests`, which is about what a tick KEEPS when the host refuses
/// part of it, and from `DeliveryTickCostTests`, which counts the requests. These are the RULES:
/// which branch the fan-out skips and which it must not.
@Suite("Delivery tick")
struct DeliveryTickTests {
    private static let landed = "argo/#99-done"
    private static let live = "argo/#1158-atlas"
    private static let spike = "spike/idea"

    private static func derivation(
        _ port: ScriptedCodeHost, into ledger: DeliveryLedger,
    )
        -> DeliveryDerivation {
        DeliveryDerivation(port: port, health: ConnectionHealthLedger(), deliveries: ledger)
    }

    /// Two ticks over the same derivation, which is the only way to observe what the second one
    /// asked about: the first fills the ledger the second reads.
    private static func twice(
        _ host: ScriptedCodeHost, over branch: String, at headSha: String? = nil,
    ) async
        -> [String] {
        await ticks(host, over: [.on(branch, at: headSha)], then: [.on(branch, at: headSha)])
    }

    /// Two ticks whose local halves differ, which is how a branch that MOVED between them is told
    /// from one that sat still.
    private static func ticks(
        _ host: ScriptedCodeHost,
        over first: [WorkspaceProjection],
        then second: [WorkspaceProjection],
    ) async
        -> [String] {
        let derivation = derivation(host, into: DeliveryLedger())
        await derivation.derive(.codeHost(), locally: .init(workspaces: first))
        await derivation.derive(.codeHost(), locally: .init(workspaces: second))
        return await host.branchesAsked()
    }

    @Test
    func `a finished Delivery is not asked about again on the next tick`() async {
        let merged = Delivery(branch: Self.landed, pullRequest: .merged(number: 3))
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.landed: merged])

        #expect(await Self.twice(host, over: Self.landed) == [Self.landed])
    }

    @Test
    func `a finished Delivery is still the one the tick records`() async {
        // Answered from the ledger rather than dropped: the row keeps its merged mark on every tick
        // after the one that read it.
        let merged = Delivery(branch: Self.landed, pullRequest: .merged(number: 3))
        let ledger = DeliveryLedger()
        let derivation = Self.derivation(
            ScriptedCodeHost([.success([])], byBranch: [Self.landed: merged]), into: ledger,
        )
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.landed)])
        await derivation.derive(.codeHost(), locally: locally)
        await derivation.derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").first?.stage == .merge)
    }

    @Test
    func `an open pull request is asked about again on the next tick`() async {
        // Nothing about it is terminal: its checks, its reviews and its own state all still move.
        let open = Delivery(branch: Self.live, pullRequest: .stub(number: 1541))
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.live: open])

        #expect(await Self.twice(host, over: Self.live) == [Self.live, Self.live])
    }

    @Test
    func `a branch the host holds nothing for is not asked about again at the same commit`() async {
        // The row this ticket is about: ~46 of a tick's 50 requests bought this same answer every
        // minute (#1619).
        let host = ScriptedCodeHost([.success([])])

        #expect(await Self.twice(host, over: Self.spike, at: "c0ffee") == [Self.spike])
    }

    @Test
    func `a branch the host holds nothing for is asked about again once its commit moves`() async {
        // A pull request opened and finished between two ticks needs a push to exist, and the push
        // is what this reads.
        let host = ScriptedCodeHost([.success([])])

        let asked = await Self.ticks(
            host, over: [.on(Self.spike, at: "c0ffee")], then: [.on(Self.spike, at: "decaf1")],
        )

        #expect(asked == [Self.spike, Self.spike])
    }

    @Test
    func `a branch the worktree listing named no commit for is asked about again`() async {
        // Degrade-down: with nothing to compare, the tick pays the request rather than claiming the
        // branch cannot have moved.
        let host = ScriptedCodeHost([.success([])])

        #expect(await Self.twice(host, over: Self.spike) == [Self.spike, Self.spike])
    }

    @Test
    func `a branch that grows its first pull request draws it without being asked`() async {
        // The rule the pruning must not break. An opened pull request is OPEN, so it arrives on the
        // in-flight listing every tick already runs — never on the branch's own request.
        let opened = Delivery(branch: Self.spike, pullRequest: .stub(number: 1620))
        let ledger = DeliveryLedger()
        let host = ScriptedCodeHost([.success([]), .success([opened])])
        let derivation = Self.derivation(host, into: ledger)
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.spike, at: "c0ffee")])
        await derivation.derive(.codeHost(), locally: locally)
        await derivation.derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").first?.pullRequest?.number == 1620)
        #expect(await host.branchesAsked() == [Self.spike])
    }

    @Test
    func `a branch of another repository at the same commit is asked about on its own`() async {
        // The commit is not a key on its own: two repositories both have `main`, and one's empty
        // answer says nothing at all about the other's.
        let host = ScriptedCodeHost([.success([])])
        let derivation = Self.derivation(host, into: DeliveryLedger())
        let locally = DeliveryDerivation.Locally(workspaces: [.on("main", at: "c0ffee")])
        await derivation.derive(.codeHost(scope: "acme/api"), locally: locally)
        await derivation.derive(.codeHost(scope: "acme/web"), locally: locally)

        #expect(await host.branchesAsked() == ["main", "main"])
    }

    @Test
    func `a branch answered empty is asked again once its pull request leaves the listing`() async {
        // The sequence a stale answer must not survive: nothing, then open — skipped through the
        // in-flight listing rather than by name — then off that listing again once it finishes.
        // A branch never asked by name in the middle tick must not be read as "still nothing" in
        // the third: that is a stale answer from before the pull request existed, not a fresh one.
        let opened = Delivery(branch: Self.spike, pullRequest: .stub(number: 1620))
        let host = ScriptedCodeHost([.success([]), .success([opened]), .success([])])
        let derivation = Self.derivation(host, into: DeliveryLedger())
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.spike, at: "c0ffee")])
        for _ in 1 ... 3 {
            await derivation.derive(.codeHost(), locally: locally)
        }

        // Asked at tick 1 and tick 3; skipped at tick 2 because the in-flight listing already
        // carried it.
        #expect(await host.branchesAsked() == [Self.spike, Self.spike])
    }
}
