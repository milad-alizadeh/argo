@testable import ArgoEngine
import Testing

/// The reading `ClaimLedger.stopSubmittedTurn` exists for: the status the stuck Session was
/// pinned at (#1409), and what ending Argo's own claim leaves behind.
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
    ///
    /// The word it lands on is named rather than merely ruled out: a Session with no Turn in the
    /// record and nothing corroborating one is `unknown`, which is the honest outline (ADR-0008)
    /// and, in the composer's own reading, a Turn that has ENDED.
    @Test
    func `the same Session with the submission ended reads what the record says`() {
        let settled = session(submitting: nil)

        #expect(settled.statusReading.status == .unknown)
        #expect(settled.statusReading.tier == .derived)
        #expect(settled.unansweredTurn == nil)
    }
}
