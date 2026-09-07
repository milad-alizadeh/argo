@testable import ArgoEngine
import Testing

/// What one tick spends (#1588) — the branches it stops asking about, and the ones it must keep
/// asking about.
///
/// Held apart from `DeliveryRefusalTests`, which is about what a tick KEEPS when the host refuses
/// part of it. These are about the tick as a budget: 63 worktree branches on this repository's own
/// checkout cost 96 requests a tick against the host's hourly 5,000.
@Suite("Delivery tick")
struct DeliveryTickTests {
    private static let landed = "argo/#99-done"
    private static let live = "argo/#1158-atlas"

    private static func derivation(
        _ port: ScriptedCodeHost, into ledger: DeliveryLedger,
    )
        -> DeliveryDerivation {
        DeliveryDerivation(port: port, health: ConnectionHealthLedger(), deliveries: ledger)
    }

    /// Two ticks over the same derivation, which is the only way to observe what the second one
    /// asked about: the first fills the ledger the second reads.
    private static func twice(
        _ host: ScriptedCodeHost, over branch: String,
    ) async
        -> [String] {
        let derivation = derivation(host, into: DeliveryLedger())
        let locally = DeliveryDerivation.Locally(workspaces: [.on(branch)])
        await derivation.derive(.codeHost(), locally: locally)
        await derivation.derive(.codeHost(), locally: locally)
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
    func `a branch the host holds no pull request for is asked about again`() async {
        // The next tick is how a branch's first pull request is ever seen.
        let host = ScriptedCodeHost([.success([])])

        #expect(await Self.twice(host, over: "spike/idea") == ["spike/idea", "spike/idea"])
    }
}
