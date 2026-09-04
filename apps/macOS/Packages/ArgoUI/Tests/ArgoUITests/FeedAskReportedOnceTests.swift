import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// One question, however many channels raised it (#1203).
///
/// The gate and the companion plugin share no id — `FeedAskProjection.matches` is a value match for
/// exactly that reason — so the words are the only thing that can tell one question from two. Two
/// cards asking the same thing would put it to the reader twice, and `FeedAsk.identity` being what
/// was asked would hand the recycled table two rows under one id.
///
/// Apart from `FeedAskReportedTests`, which is about what the reported row IS. This is about how
/// many of them there are.
@Suite("Feed reported ask, once")
struct FeedAskReportedOnceTests {
    private let reported = CompanionAsk(
        id: "call-1",
        question: "Which branch should I cut?",
        options: ["main", "the ticket branch"],
    ).ask

    /// The two channels share no id, so the words are the only thing that can tell one question
    /// from two. Where they agree the reader gets ONE card — the answerable one — since two would
    /// also hand the recycled table two rows under a single `FeedAsk.identity` (#1203).
    @Test
    func `one question raised down both channels is put to the reader once`() {
        let live = SessionAsk(id: "ask-1", ask: reported)
        let asks = FeedFixture.asks(in: FeedProjection.rows(
            from: [.prompt(text: "/implement 1205", images: [], atMs: nil)],
            asking: FeedAskProjection.Asking(
                live: FeedAskProjection.Live(
                    sessionID: "one",
                    askID: live.id,
                    ask: live.ask,
                ),
                isDriveable: true,
            ),
            reported: reported,
        ))

        #expect(asks.count == 1)
        #expect(asks[0].live != nil)
    }

    /// And where the RECORD's own row is drawing it, on the same ground: `offering` hands the
    /// gate's handle to that row, and a copy at the foot would ask again under it.
    @Test
    func `a reported question the reading already draws is not put a second time`() {
        let asked = FeedFixture.asking(Ask.Question(
            text: "Which branch should I cut?",
            options: Ask.Option.labelled(["main", "the ticket branch"]),
        ))
        let asks = FeedFixture.asks(in: FeedProjection.rows(
            from: [.toolCall(asked)],
            reported: reported,
        ))

        #expect(asks.count == 1)
    }

    /// An ANSWERED row asking the same thing is history, and history does not stand for a question
    /// being asked now — so the reported one is still put.
    @Test
    func `a settled row asking the same thing does not stand for the live question`() {
        let asked = FeedFixture.asking(Ask.Question(
            text: "Which branch should I cut?",
            options: Ask.Option.labelled(["main", "the ticket branch"]),
        ))
        let asks = FeedFixture.asks(in: FeedProjection.rows(
            from: [.toolCall(asked), .toolCallOutcome(TranscriptFixtures.printed("ask", "main"))],
            reported: reported,
        ))

        #expect(asks.map(\.isPending) == [false, true])
    }
}
