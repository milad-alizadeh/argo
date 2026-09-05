import ArgoEngine
@testable import ArgoUI
import Testing

/// What the reading shows once the work is over (#1409).
///
/// The ticket's screenshot is two indicators at once: a Plan pill reading `6/6 done · No step in
/// progress` under a plinth reading `Waiting for the agent to answer`, over an agent that had
/// already delivered its final answer. They disagree, and the disagreement is not the two surfaces'
/// to settle — #1368 draws the thread and the plinth together ON PURPOSE, and a rule making them
/// exclusive would take the double-say away from every Turn that really is running.
///
/// So the claim this suite pins is the one underneath both: with the Turn ended, no question live
/// and no Turn of Argo's unanswered, the wait surfaces go and the Plan pill stands alone. The
/// second suite is the half that must NOT move.
@Suite("Feed finished plan indicator")
@MainActor
struct FeedFinishedPlanIndicatorTests {
    private static let finished = TranscriptEvent.plan(Plan(entries: [
        PlanEntry(text: "Read the ticket", status: .completed),
        PlanEntry(text: "Build it", status: .completed),
    ]))

    private static func reading(
        status: SessionStatus,
        submittedTurn: String? = nil,
    )
        -> SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [CockpitPresentation.Session(
                    id: "session-1",
                    title: "New session",
                    access: .managed,
                    status: status,
                    chain: .init(program: .init(cli: .claude)),
                    transcript: .init(
                        events: [
                            finished,
                            .message(markdown: "Committed as 3e5557a3."),
                            .turnEnded(.endTurn),
                        ],
                        submittedTurn: submittedTurn,
                    ),
                )],
                connection: .idle,
            ),
            sessionID: "session-1",
        )
    }

    /// The end state the ticket asks for: the pill, and nothing waiting beside it.
    @Test
    func `a finished plan over an idle Session leaves the pill standing alone`() {
        let reading = Self.reading(status: .idle)

        #expect(reading.showing.plan?.current == nil)
        #expect(reading.showing.plan?.completed == 2)
        #expect(reading.wait == nil)
        #expect(!reading.hasUnansweredTurn)
        #expect(!reading.feed.contains { $0.content == .mark(.working) })
        #expect(FeedWait.showing(in: reading.feed) == nil)
    }

    /// The pill's own ring says the same thing the absent plinth does: a Session that is not
    /// running is not progressing (`cockpit-roster-row.md`, rule 3).
    @Test
    func `the pill over a finished plan is drawn still`() {
        #expect(Self.reading(status: .idle).showing.isStill)
    }

    /// The half that must not move (#1368): a Turn that really is in flight still says it twice.
    @Test
    func `a Turn still running keeps both the thread and the plinth`() {
        let reading = Self.reading(status: .running, submittedTurn: "Ship it.")

        #expect(reading.feed.contains { $0.content == .mark(.working) })
        #expect(reading.hasUnansweredTurn)
        #expect(FeedWait.showing(in: reading.feed) == .thinking)
    }
}
