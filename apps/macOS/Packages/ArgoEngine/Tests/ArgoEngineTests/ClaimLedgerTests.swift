@testable import ArgoEngine
import Testing

@MainActor
struct ClaimLedgerTests {
    private let claim = SessionOwnership.ClaimID(value: "claim-1")

    private let landed = CompanionOutcome(target: .code, reference: "abc123", summary: "landed")

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

    /// What the agent PRODUCED happened, so an orphaned Session keeps saying so.
    @Test
    func `withdrawing a claim keeps what its agent said it produced`() {
        let ledger = ClaimLedger()
        ledger.record(.outcome(landed), for: claim)
        ledger.publish(waiting: [asking("Bash")], for: claim)

        ledger.withdraw(claim)

        #expect(ledger.facts(for: claim).report?.outcomes.count == 1)
    }

    /// A reported status is a standing claim about NOW, and the channel that stood behind it is
    /// gone — so it goes with the channel and the transcript's DERIVED reading answers instead.
    /// Kept, it renders a Session as `running` long after its PTY exited (#799).
    @Test
    func `withdrawing a claim retires the status its agent reported`() {
        let ledger = ClaimLedger()
        ledger.record(.status(.running), for: claim)
        // An outcome so the report outlives the withdraw: without one the claim leaves the ledger
        // entirely and a `nil` report would pass this whether or not the status was retired.
        ledger.record(.outcome(landed), for: claim)
        ledger.publish(waiting: [asking("Bash")], for: claim)

        ledger.withdraw(claim)

        let report = ledger.facts(for: claim).report
        #expect(report != nil)
        #expect(report?.status == nil)
    }

    /// A question nobody can answer any more is not still waiting on anyone.
    @Test
    func `withdrawing a claim retires the question its agent asked`() {
        let ledger = ClaimLedger()
        ledger.record(.ask(CompanionAsk(
            id: "ask-1",
            question: "Which branch?",
            options: ["main", "next"],
        )), for: claim)
        ledger.record(.outcome(landed), for: claim)

        ledger.withdraw(claim)

        let report = ledger.facts(for: claim).report
        #expect(report != nil)
        #expect(report?.pendingAsk == nil)
    }

    /// A question raised over the plugin is answered in the COMPOSER (#1205), so the Turn Argo
    /// typed down the PTY is the act that retires it (#1203). Nothing obliges the agent to report
    /// again, and a question left standing keeps an amber card and a `NEEDS INPUT` badge up for the
    /// rest of the Session — over something the reader has already answered.
    @Test
    func `a Turn typed at the Session answers the question its agent asked`() {
        let ledger = ClaimLedger()
        ledger.record(.ask(CompanionAsk(
            id: "ask-1",
            question: "Which branch?",
            options: ["main", "next"],
        )), for: claim)

        ledger.setSubmittedTurn(SessionTurnSubmission(recordsWhenSubmitted: 3), for: claim)

        let report = ledger.facts(for: claim).report
        #expect(report?.pendingAsk == nil)
        // And the badge with it: a cleared question under a standing `asking` claim is the roster
        // telling the reader to answer something no surface can show them.
        #expect(report?.status == nil)
    }

    /// Only what the question stood on. What the agent PRODUCED is something that happened, and a
    /// status that is not a question is not this act's to take back.
    @Test
    func `answering the question leaves the rest of the report alone`() {
        let ledger = ClaimLedger()
        ledger.record(.outcome(landed), for: claim)
        ledger.record(.status(.running), for: claim)

        ledger.setSubmittedTurn(SessionTurnSubmission(recordsWhenSubmitted: 3), for: claim)

        let report = ledger.facts(for: claim).report
        #expect(report?.outcomes == [landed])
        #expect(report?.status == .running)
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
        ledger.record(.outcome(landed), for: claim)

        #expect(ledger.facts(for: claim).report?.status == .running)
        #expect(ledger.facts(for: claim).report?.outcomes.count == 1)
    }
}
