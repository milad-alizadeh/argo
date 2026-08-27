@testable import ArgoEngine
import Foundation
import Testing

/// Assembling one Project's Deliveries per branch from local git ∪ code host (`CONTEXT.md` L1 ·
/// Delivery).
@Suite("Delivery derivation")
struct DeliveryDerivationTests {
    private static func derived(
        hosted: [Delivery],
        workspaces: [WorkspaceProjection] = [],
        assertions: DeliveryAssertions = .init(),
    ) async
        -> [Delivery] {
        let ledger = DeliveryLedger()
        await DeliveryDerivation(
            port: ScriptedCodeHost([.success(hosted)]),
            health: ConnectionHealthLedger(),
            deliveries: ledger,
        )
        .derive(
            .codeHost(),
            locally: DeliveryDerivation.Locally(workspaces: workspaces, assertions: assertions),
        )
        return await ledger.deliveries(of: "P1")
    }

    @Test
    func `a branch with no pull request is a Delivery at its commits`() async {
        let derived = await Self.derived(hosted: [], workspaces: [.on("spike/idea")])

        #expect(derived.map(\.branch) == ["spike/idea"])
        #expect(derived.first?.stage == .commits)
    }

    @Test
    func `a session with no branch yields no Delivery`() async {
        // A chat or planning Session has no branch, so there is no product in flight to key on.
        let derived = await Self.derived(hosted: [], workspaces: [.on(nil), .on(nil)])

        #expect(derived.isEmpty)
    }

    @Test
    func `a teammate's pull request is derived with no local branch behind it`() async {
        let hosted = Delivery(branch: "teammate/fix", pullRequest: .stub(number: 4))
        let derived = await Self.derived(hosted: [hosted], workspaces: [.on("spike/idea")])

        #expect(derived.map(\.branch) == ["teammate/fix", "spike/idea"])
    }

    @Test
    func `a branch checked out twice is one Delivery`() async {
        let derived = await Self.derived(
            hosted: [],
            workspaces: [.on("argo/#258-code-host"), .on("argo/#258-code-host")],
        )

        #expect(derived.map(\.branch) == ["argo/#258-code-host"])
    }

    @Test
    func `a local branch the host already holds is not derived twice`() async {
        let hosted = Delivery(branch: "argo/#258-code-host", pullRequest: .stub(number: 8))
        let derived = await Self.derived(hosted: [hosted], workspaces: [.on("argo/#258-code-host")])

        #expect(derived.count == 1)
        #expect(derived.first?.pullRequest?.number == 8)
    }

    @Test
    func `a branch before its first push has no checks rather than a synthesized pass`() async {
        // Argo runs and parses no local tooling, so pre-push is "no CI yet" and never a result.
        let derived = await Self.derived(hosted: [], workspaces: [.on("spike/idea")])

        #expect(derived.first?.checks.isEmpty == true)
    }

    @Test
    func `an assertion links a branch the derivation found nothing for`() async {
        var assertions = DeliveryAssertions()
        assertions.assert(31, forBranch: "hotfix", in: "P1")
        let derived = await Self.derived(
            hosted: [], workspaces: [.on("hotfix")], assertions: assertions,
        )

        #expect(derived.first?.workItem == .asserted(31))
    }

    @Test
    func `an assertion for another Project does not link this one's branch`() async {
        var assertions = DeliveryAssertions()
        assertions.assert(31, forBranch: "hotfix", in: "P2")
        let derived = await Self.derived(
            hosted: [], workspaces: [.on("hotfix")], assertions: assertions,
        )

        #expect(derived.first?.workItem == .unlinked)
    }

    @Test
    func `a failed read leaves the last derivation exactly where it was`() async {
        let ledger = DeliveryLedger()
        let derivation = DeliveryDerivation(
            port: ScriptedCodeHost([
                .success([Delivery(branch: "argo/#258-code-host", pullRequest: .stub(number: 8))]),
                .failure(.offline),
            ]),
            health: ConnectionHealthLedger(),
            deliveries: ledger,
        )
        await derivation.derive(.codeHost(), locally: .init(workspaces: []))
        await derivation.derive(.codeHost(), locally: .init(workspaces: []))

        #expect(await ledger.deliveries(of: "P1").map(\.branch) == ["argo/#258-code-host"])
    }

    @Test
    func `a Project nobody has read has no Deliveries, and never another Project's`() async {
        let ledger = DeliveryLedger()
        await ledger.record([Delivery(branch: "argo/#258-code-host", pullRequest: nil)], for: "P1")

        #expect(await ledger.deliveries(of: "P2").isEmpty)
        #expect(await ledger.deliveries(of: nil).isEmpty)
    }

    @Test
    func `a Delivery is found by the branch it is the life of`() async {
        let ledger = DeliveryLedger()
        await ledger.record([Delivery(branch: "argo/#258-code-host", pullRequest: nil)], for: "P1")

        #expect(await ledger.delivery(ofBranch: "argo/#258-code-host", in: "P1") != nil)
        #expect(await ledger.delivery(ofBranch: "spike/idea", in: "P1") == nil)
    }
}
