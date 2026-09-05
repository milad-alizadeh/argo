@testable import ArgoEngine
import Testing

/// A Turn Argo typed that the reader then STOPPED (#1409).
///
/// `SessionTurnSubmission` ends on the record growing and on nothing else, which leaves one act
/// with no way out: an interrupt reaches a CLI that has already returned to its prompt, so no
/// record is written, the count never moves and the Session reads `running` at DIRECT for the rest
/// of the window's life. Stop is then a no-op on screen — it really did type its `ESC`, and the
/// claim it was pressed against is not one an `ESC` can end.
///
/// So the reader's own gesture ends it, exactly as `setLostTurn` does for the Turn nobody heard:
/// a Turn Argo typed and then stopped is not a Turn in flight, whatever the record says next.
@MainActor
@Suite("Claim ledger stopped turn")
struct ClaimLedgerStoppedTurnTests {
    private let claim = SessionOwnership.ClaimID(value: "claim-1")
    private let submission = SessionTurnSubmission(text: "Ship it.", recordsWhenSubmitted: 3)

    @Test
    func `stopping the Turn ends the submission Argo filed`() {
        let ledger = ClaimLedger()
        ledger.setSubmittedTurn(submission, for: claim)

        ledger.stopSubmittedTurn(for: claim)

        #expect(ledger.facts(for: claim).submittedTurn == nil)
    }

    /// Only the Turn. What the agent produced and the rung Argo set are things that HAPPENED, and
    /// stopping a Turn is not this act's to take them back with.
    @Test
    func `stopping the Turn leaves the rest of the claim alone`() {
        let ledger = ClaimLedger()
        ledger.record(.status(.running), for: claim)
        ledger.setMode(SessionModeSet(mode: .plan), for: claim)
        ledger.setSubmittedTurn(submission, for: claim)

        ledger.stopSubmittedTurn(for: claim)

        #expect(ledger.facts(for: claim).report?.status == .running)
        #expect(ledger.facts(for: claim).modeSet?.mode == .plan)
    }

    /// A Stop pressed on a Session with no Turn of Argo's in flight files nothing — the reader may
    /// press it over a Turn the CLI started itself, and there is no claim of ours to end.
    @Test
    func `stopping a Turn Argo never typed changes nothing`() {
        let ledger = ClaimLedger()

        ledger.stopSubmittedTurn(for: claim)

        #expect(ledger.facts(for: claim).submittedTurn == nil)
    }
}

/// The reading the act above exists for: the status the stuck Session was pinned at.
@MainActor
@Suite("Hub session stopped turn")
struct HubSessionStoppedTurnTests {
    private func session(submitting submission: SessionTurnSubmission?) -> HubSession {
        var session = HubSession(observation: hubTestObservation(id: "session", events: []))
        session.submittedTurn = submission
        return session
    }

    /// The state the ticket screenshotted: a Turn typed, no record since, `running` for ever.
    @Test
    func `a Turn no record has answered reads running`() {
        let stuck = session(submitting: SessionTurnSubmission(
            text: "Ship it.",
            recordsWhenSubmitted: 0,
        ))

        #expect(stuck.statusReading.status == .running)
        #expect(stuck.unansweredTurn == "Ship it.")
    }

    /// And with the submission ended, the reading falls through to what the record says — which is
    /// what takes the plinth, the working row and the queue-only composer down with it.
    @Test
    func `the same Session with the submission ended no longer reads running`() {
        #expect(session(submitting: nil).statusReading.status != .running)
    }
}
