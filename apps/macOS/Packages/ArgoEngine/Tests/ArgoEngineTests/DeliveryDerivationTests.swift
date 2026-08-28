@testable import ArgoEngine
import Foundation
import Testing

/// Assembling one Project's Deliveries per branch from local git ∪ code host (`CONTEXT.md` L1 ·
/// Delivery).
@Suite("Delivery derivation")
struct DeliveryDerivationTests {
    private static func derived(
        inFlight: [Delivery] = [],
        workspaces: [WorkspaceProjection] = [],
        held: Held = Held(),
    ) async
        -> [Delivery] {
        let ledger = DeliveryLedger()
        await DeliveryDerivation(
            port: ScriptedCodeHost([.success(inFlight)], byBranch: held.byBranch),
            health: ConnectionHealthLedger(),
            deliveries: ledger,
        )
        .derive(
            .codeHost(),
            locally: DeliveryDerivation.Locally(
                workspaces: workspaces, assertions: held.assertions,
            ),
        )
        return await ledger.deliveries(of: "P1")
    }

    /// What the host holds off the in-flight listing, and what a human asserted — grouped so the
    /// helper above stays inside the parameter cap.
    struct Held {
        var byBranch: [String: Delivery] = [:]
        var assertions = DeliveryAssertions()
    }

    @Test
    func `a branch the host holds nothing for is a Delivery at its commits`() async {
        let derived = await Self.derived(workspaces: [.on("spike/idea")])

        #expect(derived.map(\.branch) == ["spike/idea"])
        #expect(derived.first?.stage == .commits)
    }

    @Test
    func `a session with no branch yields no Delivery`() async {
        // A chat or planning Session has no branch, so there is no product in flight to key on.
        let derived = await Self.derived(workspaces: [.on(nil), .on(nil)])

        #expect(derived.isEmpty)
    }

    @Test
    func `a teammate's pull request is derived with no local branch behind it`() async {
        let hosted = Delivery(branch: "teammate/fix", pullRequest: .stub(number: 4))
        let derived = await Self.derived(inFlight: [hosted], workspaces: [.on("spike/idea")])

        #expect(derived.map(\.branch) == ["teammate/fix", "spike/idea"])
    }

    @Test
    func `a branch checked out twice is one Delivery`() async {
        let derived = await Self.derived(
            workspaces: [.on("argo/#258-code-host"), .on("argo/#258-code-host")],
        )

        #expect(derived.map(\.branch) == ["argo/#258-code-host"])
    }

    @Test
    func `a local branch already in flight is not derived twice`() async {
        let hosted = Delivery(branch: "argo/#258-code-host", pullRequest: .stub(number: 8))
        let derived = await Self.derived(
            inFlight: [hosted], workspaces: [.on("argo/#258-code-host")],
        )

        #expect(derived.count == 1)
        #expect(derived.first?.pullRequest?.number == 8)
    }

    @Test
    func `a local branch whose pull request already merged reaches the terminal node`() async {
        // The in-flight listing is bounded by what is open, so merge is reached by asking the host
        // about the branch by name.
        let merged = Delivery(branch: "argo/#99-done", pullRequest: .merged(number: 3))
        let derived = await Self.derived(
            workspaces: [.on("argo/#99-done")],
            held: Held(byBranch: ["argo/#99-done": merged]),
        )

        #expect(derived.first?.stage == .merge)
    }

    @Test
    func `a branch before its first push has no checks rather than a synthesized pass`() async {
        // Argo runs and parses no local tooling, so pre-push is "no CI yet" and never a result.
        let derived = await Self.derived(workspaces: [.on("spike/idea")])

        #expect(derived.first?.checks.isEmpty == true)
    }

    @Test
    func `an assertion links a branch the derivation found nothing for`() async {
        var assertions = DeliveryAssertions()
        assertions.assert(31, forBranch: "hotfix", in: "P1")
        let derived = await Self.derived(
            workspaces: [.on("hotfix")], held: Held(assertions: assertions),
        )

        #expect(derived.first?.ticket == .asserted(31))
    }

    @Test
    func `an assertion made for another Project leaves this one's branch unlinked`() async {
        var assertions = DeliveryAssertions()
        assertions.assert(31, forBranch: "hotfix", in: "P2")
        let derived = await Self.derived(
            workspaces: [.on("hotfix")], held: Held(assertions: assertions),
        )

        #expect(derived.first?.ticket == .unlinked)
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
    func `a derivation that failed still says it has landed`() async {
        // The strip did not move, but the health behind the provider's own dot did.
        let landings = DeliveryLandings()
        let derivation = DeliveryDerivation(
            port: ScriptedCodeHost([.failure(.offline)]),
            health: ConnectionHealthLedger(),
            deliveries: DeliveryLedger(),
        )
        await derivation.report(to: landings.raise)
        await derivation.derive(.codeHost(), locally: .init(workspaces: []))

        #expect(await landings.raised() == 1)
    }
}
