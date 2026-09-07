@testable import ArgoEngine
import Testing

/// What a derivation keeps for the branches its LOCAL half did not hold (#1617) — a tick that did
/// not fail, and still saw fewer branches than the one before it.
///
/// Measured rather than reasoned about, against this repository's own checkout: the local half is
/// asked for at the moment of the tick, and an instrumented build recorded a healthy tick deriving
/// against `Locally.workspaces` of length 0 while another was deriving against 33. Every mark in
/// that ledger came from the fan-out over the local half and none from the in-flight listing, so
/// the shorter tick's recording took every one of them off the roster.
@Suite("Delivery carry")
struct DeliveryCarryTests {
    private static let atlas = "argo/#1158-atlas"
    private static let prose = "worktree-ticket-1597-prose-ink"

    @Test
    func `a tick that saw no local branches keeps what the last one established`() async {
        let merged = Delivery(branch: Self.prose, pullRequest: .merged(number: 1615))
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.prose: merged])
        let ledger = DeliveryLedger()
        let derivation = Self.derivation(host, into: ledger)
        await derivation.derive(.codeHost(), locally: .init(workspaces: [.on(Self.prose)]))
        await derivation.derive(.codeHost(), locally: .init(workspaces: []))

        #expect(await ledger.delivery(ofBranch: Self.prose, in: "P1")?.stage == .merge)
    }

    @Test
    func `a tick that saw one of two branches keeps the other's Delivery`() async {
        let merged = Delivery(branch: Self.prose, pullRequest: .merged(number: 1615))
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.prose: merged])
        let ledger = DeliveryLedger()
        let derivation = Self.derivation(host, into: ledger)
        await derivation.derive(
            .codeHost(), locally: .init(workspaces: [.on(Self.prose), .on(Self.atlas)]),
        )
        await derivation.derive(.codeHost(), locally: .init(workspaces: [.on(Self.atlas)]))

        #expect(await ledger.delivery(ofBranch: Self.prose, in: "P1")?.stage == .merge)
        #expect(await ledger.delivery(ofBranch: Self.atlas, in: "P1")?.stage == .commits)
    }

    @Test
    func `a branch the host now answers differently for is not held to the carried answer`() async {
        // Carrying is for the branches a tick never reached. One it DID ask about is recorded at
        // whatever the host just said, or the ledger would freeze on the first answer forever.
        let open = Delivery(branch: Self.atlas, pullRequest: .stub(number: 1541))
        let landed = Delivery(branch: Self.atlas, pullRequest: .merged(number: 1541))
        let ledger = DeliveryLedger()
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.atlas)])
        await Self.derivation(
            ScriptedCodeHost([.success([])], byBranch: [Self.atlas: open]), into: ledger,
        )
        .derive(.codeHost(), locally: locally)
        await Self.derivation(
            ScriptedCodeHost([.success([])], byBranch: [Self.atlas: landed]), into: ledger,
        )
        .derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").map(\.stage) == [.merge])
    }

    @Test
    func `a carried Delivery is not recorded twice for its branch`() async {
        let merged = Delivery(branch: Self.prose, pullRequest: .merged(number: 1615))
        let host = ScriptedCodeHost([.success([])], byBranch: [Self.prose: merged])
        let ledger = DeliveryLedger()
        let derivation = Self.derivation(host, into: ledger)
        let locally = DeliveryDerivation.Locally(workspaces: [.on(Self.prose)])
        await derivation.derive(.codeHost(), locally: locally)
        await derivation.derive(.codeHost(), locally: .init(workspaces: []))
        await derivation.derive(.codeHost(), locally: locally)

        #expect(await ledger.deliveries(of: "P1").map(\.branch) == [Self.prose])
    }

    private static func derivation(
        _ port: ScriptedCodeHost, into ledger: DeliveryLedger,
    )
        -> DeliveryDerivation {
        DeliveryDerivation(port: port, health: ConnectionHealthLedger(), deliveries: ledger)
    }
}
