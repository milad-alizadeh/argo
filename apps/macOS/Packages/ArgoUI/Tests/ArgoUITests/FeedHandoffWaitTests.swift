import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Testing

/// The handoff's own wait on the plinth (#1327) — its own suite for the reason
/// `FeedResumeWaitTests`
/// is beside `FeedWaitTests`: what it draws is a case of the surface `FeedWaitTests` already covers
/// end to end for a fresh spawn. Where it lands in the reading once it ends, success or failure, is
/// `FeedHandoffTests`'s — this covers only the plinth and the words.
@Suite("Feed handoff wait")
@MainActor
struct FeedHandoffWaitTests {
    /// A running handoff raises its own plinth, off the same fact the header button reads —
    /// outranking the startup wait, since a Session mid-handoff has long since printed its first
    /// byte and can never itself read `starting`.
    @Test
    func `a running handoff raises the plinth and writes no row`() {
        let session = CockpitPresentation.Session(
            id: "session-1",
            title: "New session",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude), handoff: .init(handingOff: true)),
        )
        let reading = SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [session],
                connection: .idle,
            ),
            sessionID: "session-1",
        )

        #expect(reading.wait == .handingOff)
        #expect(reading.feed.isEmpty)
    }

    /// The handoff's own words. Its running and failed tenses are the whole surface: a landed one
    /// drops no settled row of its own — the existing `handedOff` link row is that.
    @Test
    func `the handoff wait has its own running and failed words`() {
        #expect(FeedWaitWords.handingOff.running == "Handing off the current session")
        #expect(FeedWaitWords.handingOff.failed == "The handoff failed")
        #expect(FeedWaitWords.handingOff.symbol == ArgoSymbol.handedOff)
        #expect(FeedWaitWords(.handingOff) == .handingOff)
        #expect(FeedWaitWords(SessionWaitSettled.Wait.handingOff) == .handingOff)
    }
}
