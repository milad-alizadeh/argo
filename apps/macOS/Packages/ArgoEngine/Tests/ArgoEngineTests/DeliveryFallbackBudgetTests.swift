@testable import ArgoEngine
import Testing

/// The decided cap on one tick's local fallback (#1571) — how many branches a listing held nothing
/// for get asked about by name in one tick, and that the rest catch up over the ticks that follow
/// rather than a checkout's worktree count setting the bill.
@Suite("Delivery fallback budget")
struct DeliveryFallbackBudgetTests {
    private static let budget = DeliveryDerivation.localFallbackBudget

    private static func branches(_ count: Int) -> [String] {
        (0 ..< count).map { "spike/idea-\($0)" }
    }

    @Test
    func `one tick asks about no more than the decided budget`() async {
        let all = Self.branches(Self.budget + 5)
        let host = ScriptedCodeHost([.success([])])
        let derivation = DeliveryDerivation.over(host, into: DeliveryLedger())
        let locally = DeliveryDerivation.Locally(workspaces: all.map { .on($0) })

        await derivation.derive(.codeHost(), locally: locally)

        #expect(await host.branchesAsked().count == Self.budget)
    }

    @Test
    func `the branches past the budget are asked on the tick after`() async {
        let all = Self.branches(Self.budget + 5)
        let host = ScriptedCodeHost([.success([])])
        let derivation = DeliveryDerivation.over(host, into: DeliveryLedger())
        let locally = DeliveryDerivation.Locally(workspaces: all.map { .on($0) })

        await derivation.derive(.codeHost(), locally: locally)
        await derivation.derive(.codeHost(), locally: locally)

        #expect(await Set(host.branchesAsked()) == Set(all))
    }

    @Test
    func `a branch with an open pull request is asked every tick regardless of the cap`() async {
        // Saturating the fallback budget with branches that have no pull request at all must not
        // delay a Session's own row: that branch never reaches the fallback loop, it arrives
        // through the in-flight listing, which the budget never touches.
        let live = "argo/#1158-atlas"
        let hosted = Delivery(branch: live, pullRequest: .stub(number: 1541))
        let saturating = Self.branches(Self.budget)
        let host = ScriptedCodeHost([.success([hosted])])
        let ledger = DeliveryLedger()
        let derivation = DeliveryDerivation.over(host, into: ledger)
        let locally = DeliveryDerivation.Locally(
            workspaces: (saturating + [live]).map { .on($0) },
        )

        await derivation.derive(.codeHost(), locally: locally)

        #expect(await ledger.delivery(ofBranch: live, in: "P1")?.pullRequest?.number == 1541)
    }
}
