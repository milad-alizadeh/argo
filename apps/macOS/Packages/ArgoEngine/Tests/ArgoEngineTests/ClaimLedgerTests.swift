@testable import ArgoEngine
import Testing

@MainActor
struct ClaimLedgerTests {
    private let claim = SessionOwnership.ClaimID(value: "claim-1")

    private func asking(_ toolName: String) -> PermissionRequest {
        PermissionRequest(id: "p-\(toolName)", toolName: toolName, target: .command(toolName))
    }

    @Test
    func `a claim nothing has been published for knows nothing`() {
        let ledger = ClaimLedger()
        #expect(ledger.facts(for: claim) == ClaimFacts())
    }

    @Test
    func `a Session with no claim knows nothing`() {
        let ledger = ClaimLedger()
        ledger.publish(waiting: [asking("Bash")], for: claim)
        #expect(ledger.facts(for: nil) == ClaimFacts())
    }

    @Test
    func `answering the last waiting Permission leaves the claim knowing nothing`() {
        let ledger = ClaimLedger()
        ledger.publish(waiting: [asking("Bash")], for: claim)
        ledger.publish(waiting: [], for: claim)
        #expect(ledger.facts(for: claim) == ClaimFacts())
    }

    /// Three tables until #634, so no test could name this: answering the last prompt left the
    /// claim in the pending table, and only the standing one was checked.
    @Test
    func `withdrawing a claim clears every gate fact of it at once`() {
        let ledger = ClaimLedger()
        ledger.publish(waiting: [asking("Bash")], for: claim)
        ledger.publish(standing: [StandingAllow(toolName: "Read")], for: claim)
        ledger.publish(expired: [PermissionExpiry(id: "p-1", toolName: "Grep")], for: claim)

        ledger.withdraw(claim)

        #expect(ledger.facts(for: claim) == ClaimFacts())
    }

    /// The gate is what died with the PTY. What the agent SAID happened, so an orphaned Session
    /// keeps its CONVENTION reading.
    @Test
    func `withdrawing a claim keeps what its agent said`() {
        let ledger = ClaimLedger()
        ledger.record(.status(.running), for: claim)
        ledger.publish(waiting: [asking("Bash")], for: claim)

        ledger.withdraw(claim)

        #expect(ledger.facts(for: claim).report?.status == .running)
    }

    @Test
    func `withdrawing a claim keeps the rung Argo put it on`() {
        let ledger = ClaimLedger()
        ledger.setMode(SessionModeSet(mode: .plan), for: claim)
        ledger.publish(waiting: [asking("Bash")], for: claim)

        ledger.withdraw(claim)

        #expect(ledger.facts(for: claim).modeSet?.mode == .plan)
    }

    /// One report per claim, folded rather than replaced — two facts arrive as two messages.
    @Test
    func `a second reported fact joins the first rather than replacing it`() {
        let ledger = ClaimLedger()
        ledger.record(.status(.running), for: claim)
        ledger.record(.outcome(CompanionOutcome(
            target: .code,
            reference: "abc123",
            summary: "landed",
        )), for: claim)

        #expect(ledger.facts(for: claim).report?.status == .running)
        #expect(ledger.facts(for: claim).report?.outcomes.count == 1)
    }
}
