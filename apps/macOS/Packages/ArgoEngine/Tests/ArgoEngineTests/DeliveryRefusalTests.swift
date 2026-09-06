@testable import ArgoEngine
import Testing

/// What a derivation keeps when the host refuses PART of it (#1546) — the fan-out asks once per
/// local branch the in-flight listing did not hold, so on a checkout with dozens of worktrees the
/// refusal is the host's rate limit rather than an outage, and it arrives half way through.
@Suite("Delivery refusal")
struct DeliveryRefusalTests {
    private static let atlas = "argo/#1158-atlas"
    private static let stale = "worktree-1503-stale"

    @Test
    func `a refused branch read leaves the listing's own Deliveries standing`() async {
        let hosted = Delivery(branch: Self.atlas, pullRequest: .stub(number: 1541))
        let ledger = DeliveryLedger()
        await Self.derivation(
            ScriptedCodeHost([.success([hosted])], refusing: [Self.stale]), into: ledger,
        )
        .derive(.codeHost(), locally: .init(workspaces: [.on(Self.atlas), .on(Self.stale)]))

        #expect(await ledger.deliveries(of: "P1").first?.pullRequest?.number == 1541)
    }

    @Test
    func `a branch nothing has derived yet and the host refused is no Delivery at all`() async {
        // Never one at its commits: that is what a branch the host ANSWERED nothing for reads, and
        // a refusal established nothing to tell the two apart with.
        let ledger = DeliveryLedger()
        await Self.derivation(
            ScriptedCodeHost([.success([])], refusing: [Self.stale]), into: ledger,
        )
        .derive(.codeHost(), locally: .init(workspaces: [.on(Self.stale)]))

        #expect(await ledger.deliveries(of: "P1").isEmpty)
    }

    @Test
    func `a refusal keeps what the last derivation established for the branches beyond it`() async {
        // The in-flight listing is bounded by what is open, so a merged Delivery only ever comes
        // from the fan-out: recording the refused read's own short set would empty a strip that
        // was full.
        let merged = Delivery(branch: Self.stale, pullRequest: .merged(number: 3))
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.stale: merged])
        let ledger = DeliveryLedger()
        let derivation = Self.derivation(host, into: ledger)
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.stale)])
        await derivation.derive(.codeHost(), locally: locally)
        await host.refuse([Self.stale])
        await derivation.derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").first?.stage == .merge)
    }

    private static func derivation(
        _ port: ScriptedCodeHost, into ledger: DeliveryLedger,
    )
        -> DeliveryDerivation {
        DeliveryDerivation(port: port, health: ConnectionHealthLedger(), deliveries: ledger)
    }
}
