@testable import ArgoEngine
import Testing

/// A self-reported `asking` with no question behind it (#1409).
///
/// `CompanionReport.apply` sets `asking` off `report_status` alone, and nothing retires it: there
/// is no question for an answer to arrive at, so `answered()` never runs, and an agent that has
/// moved on reports its next status only if it chooses to. Left standing, the CONVENTION word
/// outranks every DERIVED reading below it for the rest of the Session — the feed draws no
/// question, the composer holds every follow-up against a Turn that ended long ago, and nothing on
/// the row can move. #1205 fixed the pair that move TOGETHER; this is the one that arrives alone.
@Suite("Hub session reported asking")
struct HubSessionReportedAskingTests {
    private func session(reporting fact: CompanionFact) -> HubSession {
        var session = HubSession(observation: hubTestObservation(id: "session", events: []))
        var report = CompanionReport()
        report.apply(fact)
        session.convention = report
        session.companionChannel = .live
        return session
    }

    /// Degrade-down (ADR-0008): with no question to show, the quieter reading is the honest one.
    @Test
    func `an asking status with no question behind it does not hold the status`() {
        #expect(session(reporting: .status(.asking)).statusReading.status != .asking)
    }

    /// The half that must not move: a question the agent really did raise still reads `asking`, at
    /// CONVENTION, exactly as #1205 established.
    @Test
    func `an asking status over a live question still reads asking`() {
        let ask = CompanionAsk(id: "ask-1", question: "Which branch?", options: ["main"])
        let reading = session(reporting: .ask(ask)).statusReading

        #expect(reading.status == .asking)
        #expect(reading.tier == .convention)
    }

    /// Every other word the agent can report is a claim about what it is DOING rather than about a
    /// question waiting on anybody, so none of them is gated on `pendingAsk`.
    @Test
    func `a reported status that is not asking is unaffected`() {
        #expect(session(reporting: .status(.running)).statusReading.status == .running)
        #expect(session(reporting: .status(.idle)).statusReading.status == .idle)
    }
}
