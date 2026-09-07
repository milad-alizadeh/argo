@testable import ArgoEngine
import Testing

/// What the ledger keeps for the branches a derivation's LOCAL half did not hold (#1617) — a tick
/// that did not fail, and still saw fewer branches than the one before it. The measurement is in
/// `DeliveryLedger.record`.
@Suite("Delivery carry")
struct DeliveryCarryTests {
    private static let atlas = "argo/#1158-atlas"
    private static let prose = "worktree-ticket-1597-prose-ink"
    private static let merged = Delivery(branch: prose, pullRequest: .merged(number: 1615))

    /// The two ways a later tick sees less than the one before it: none of the branches, and only
    /// some. One behaviour — a Delivery the ledger holds outlives the tick that missed it.
    @Test(arguments: [[], [WorkspaceProjection.on(atlas)]])
    func `a branch the tick never reached keeps its Delivery`(
        _ shortened: [WorkspaceProjection],
    ) async {
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.prose: Self.merged])
        let ledger = DeliveryLedger()
        let derivation = DeliveryDerivation.over(host, into: ledger)
        await derivation.derive(
            .codeHost(), locally: .init(workspaces: [.on(Self.prose), .on(Self.atlas)]),
        )
        await derivation.derive(.codeHost(), locally: .init(workspaces: shortened))

        #expect(await ledger.delivery(ofBranch: Self.prose, in: "P1")?.stage == .merge)
    }

    @Test
    func `a branch the host now answers differently for is not held to the kept answer`() async {
        // Keeping is for the branches a tick never reached. One it DID ask about is recorded at
        // whatever the host just said, or the ledger would freeze on the first answer forever.
        let open = Delivery(branch: Self.atlas, pullRequest: .stub(number: 1541))
        let landed = Delivery(branch: Self.atlas, pullRequest: .merged(number: 1541))
        let ledger = DeliveryLedger()
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.atlas)])
        await DeliveryDerivation.over(
            ScriptedCodeHost([.success([])], byBranch: [Self.atlas: open]), into: ledger,
        )
        .derive(.codeHost(), locally: locally)
        await DeliveryDerivation.over(
            ScriptedCodeHost([.success([])], byBranch: [Self.atlas: landed]), into: ledger,
        )
        .derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").map(\.stage) == [.merge])
    }

    @Test
    func `a kept Delivery is not recorded twice for its branch`() async {
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.prose: Self.merged])
        let ledger = DeliveryLedger()
        let derivation = DeliveryDerivation.over(host, into: ledger)
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.prose)])
        await derivation.derive(.codeHost(), locally: locally)
        await derivation.derive(.codeHost(), locally: .init(workspaces: []))
        await derivation.derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").map(\.branch) == [Self.prose])
    }

    @Test
    func `what is recorded does not depend on which branches the tick saw`() async {
        // `DeliveryReadings.read` publishes on array inequality, so an order that follows the local
        // half would rebuild the whole shell on every tick of an alternating one (#858).
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.prose: Self.merged])
        let ledger = DeliveryLedger()
        let derivation = DeliveryDerivation.over(host, into: ledger)
        let whole = DeliveryDerivation.Locally(workspaces: [.on(Self.prose), .on(Self.atlas)])
        await derivation.derive(.codeHost(), locally: whole)
        await derivation.derive(.codeHost(), locally: .init(workspaces: [.on(Self.atlas)]))
        let shortened = await ledger.deliveries(of: "P1")
        await derivation.derive(.codeHost(), locally: whole)

        #expect(await ledger.deliveries(of: "P1") == shortened)
    }
}
