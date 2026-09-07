@testable import ArgoEngine
import Testing

/// The `ESC` Argo sent, filed as a fact of its own (#1644).
///
/// `ClaimLedger.stopSubmittedTurn` ends a claim of Argo's and puts nothing in its place, which is
/// enough only while some other reading can say the Turn is over. Interrupted inside a tool call
/// nothing can: the CLI writes no sentence for the act, the record's last `stop_reason` is
/// `tool_use` and ends nothing, and `ESC` keeps the process by design (ADR-0024). So the keystroke
/// is filed, and it is what speaks for the Turn until the record does.
@MainActor
@Suite("Claim ledger stop claim")
struct ClaimLedgerStopClaimTests {
    private let claim = SessionOwnership.ClaimID(value: "claim-1")
    private let stop = SessionStopClaim(recordsWhenStopped: 4)

    /// The whole of the reported bug, and the one test the old guard fails. Interrupted inside a
    /// tool call, the assistant record carrying the call landed BEFORE the reader reached for Stop,
    /// so the submission was already spent and there was no claim of Argo's to end — a stop filed
    /// only where one stood files nothing in exactly the case that was reported.
    @Test
    func `an ESC over a spent submission is filed anyway`() {
        let ledger = ClaimLedger()

        ledger.setStopClaim(stop, for: claim)

        #expect(ledger.facts(for: claim).stopClaim == stop)
    }

    /// And the roster hears about it, which is the other half of "within one projection pass": the
    /// memo the cockpit redraws off is keyed by this number (#634).
    @Test
    func `filing an ESC moves the revision the roster is memoed by`() {
        let ledger = ClaimLedger()
        let before = ledger.revision

        ledger.setStopClaim(stop, for: claim)

        #expect(ledger.revision > before)
    }

    /// The #1409 half, kept: a Turn Argo typed and then stopped is not a Turn in flight, whatever
    /// the record says next.
    @Test
    func `an ESC ends the submission Argo filed`() {
        let ledger = ClaimLedger()
        ledger.setSubmittedTurn(
            SessionTurnSubmission(text: "Ship it.", recordsWhenSubmitted: 4),
            for: claim,
        )

        ledger.setStopClaim(stop, for: claim)

        #expect(ledger.facts(for: claim).submittedTurn == nil)
    }

    /// A STEER is an interrupt with a Turn behind it (#1238), and the send is what stands. The stop
    /// its own interrupt filed must go with it, or steering would leave the row reading idle over a
    /// Turn Argo had just typed.
    @Test
    func `a steer's send drops the stop its interrupt filed`() {
        let ledger = ClaimLedger()
        ledger.setStopClaim(stop, for: claim)

        ledger.setSubmittedTurn(
            SessionTurnSubmission(text: "No, the caption.", recordsWhenSubmitted: 4),
            for: claim,
        )

        #expect(ledger.facts(for: claim).stopClaim == nil)
    }

    /// Only the Turn. What the agent produced and the rung Argo set are things that HAPPENED, and
    /// stopping a Turn is not this act's to take them back with.
    @Test
    func `an ESC leaves the rest of the claim alone`() {
        let ledger = ClaimLedger()
        ledger.record(.status(.running), for: claim)
        ledger.setMode(SessionModeSet(mode: .plan), for: claim)

        ledger.setStopClaim(stop, for: claim)

        #expect(ledger.facts(for: claim).report?.status == .running)
        #expect(ledger.facts(for: claim).modeSet?.mode == .plan)
    }

    /// The claim cannot outlive the channel it was witnessed on (#1048). And it should not want to:
    /// a Session whose PTY has gone reads `ended` off its orphaned provenance, which is louder news
    /// than the quiet word this was holding.
    @Test
    func `withdrawing the claim takes the ESC with it`() {
        let ledger = ClaimLedger()
        ledger.setStopClaim(stop, for: claim)

        ledger.withdraw(claim)

        #expect(ledger.facts(for: claim).stopClaim == nil)
    }
}
