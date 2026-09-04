@testable import ArgoEngine
import Testing

/// The question an agent raised over the companion plugin, as the roster publishes it (#1205).
///
/// `CompanionReport.pendingAsk` set `status = .asking` and reached no surface at all, so a Session
/// blocked on `ask_user` wore `Needs input` over a reading with nothing in it to answer. This is
/// the one fact that carries it out of the package.
@Suite("Hub session companion ask")
struct HubSessionCompanionAskTests {
    private let ask = CompanionAsk(id: "ask-1", question: "Which branch?", options: ["main"])

    private func session(
        reporting ask: CompanionAsk?,
        over channel: CompanionLiveness,
    )
        -> HubSession {
        var session = HubSession(observation: hubTestObservation(id: "session", events: []))
        var report = CompanionReport()
        if let ask {
            report.apply(.ask(ask))
        }
        session.convention = report
        session.companionChannel = channel
        return session
    }

    @Test
    func `a question reported over a live channel is published`() {
        #expect(session(reporting: ask, over: .live).companionAsk == ask)
    }

    /// The report's standing claims die with the channel they stood on — the rule
    /// `CompanionReport.channelClosed` applies when the CLAIM is withdrawn. A channel whose last
    /// client hung up while the PTY lived reaches no such call, so the reading is taken here: an
    /// unanswered question is a claim about NOW, and nothing is left to withdraw it.
    @Test
    func `a question left standing on a dropped channel is not published`() {
        #expect(session(reporting: ask, over: .dropped).companionAsk == nil)
    }

    /// Every external Session, and every CLI that takes no plugin.
    @Test
    func `a Session with no channel of Argo's reports no question`() {
        #expect(session(reporting: ask, over: .notApplicable).companionAsk == nil)
    }

    @Test
    func `a Session whose agent has raised nothing publishes nothing`() {
        #expect(session(reporting: nil, over: .live).companionAsk == nil)
    }
}
