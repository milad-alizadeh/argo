@testable import ArgoEngine
import Testing

/// The only place a Delivery lives, keyed by the branch it is the life of.
@Suite("Delivery ledger")
struct DeliveryLedgerTests {
    private static func loaded() async -> DeliveryLedger {
        let ledger = DeliveryLedger()
        await ledger.record([Delivery(branch: "argo/#258-code-host", pullRequest: nil)], for: "P1")
        return ledger
    }

    @Test
    func `a Project nobody has read has no Deliveries`() async {
        #expect(await Self.loaded().deliveries(of: "P2").isEmpty)
    }

    @Test
    func `a window pointed at no Project draws no Deliveries`() async {
        #expect(await Self.loaded().deliveries(of: nil).isEmpty)
    }

    @Test
    func `a Delivery is found by the branch it is the life of`() async {
        #expect(await Self.loaded().delivery(ofBranch: "argo/#258-code-host", in: "P1") != nil)
    }

    @Test
    func `a branch nothing was derived for has no Delivery`() async {
        #expect(await Self.loaded().delivery(ofBranch: "spike/idea", in: "P1") == nil)
    }

    @Test
    func `a second derivation replaces the first whole`() async {
        let ledger = await Self.loaded()
        await ledger.record([Delivery(branch: "spike/idea", pullRequest: nil)], for: "P1")

        #expect(await ledger.deliveries(of: "P1").map(\.branch) == ["spike/idea"])
    }
}
