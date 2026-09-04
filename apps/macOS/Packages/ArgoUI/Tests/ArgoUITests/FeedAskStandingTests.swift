import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The question Argo's own gate is holding, put to the reader when no row of the record's is
/// drawing it (#1190). The roster reads `Needs input` at DIRECT off exactly that gate, so a
/// reading with nothing in it tells somebody to answer and gives them nothing to answer.
///
/// Apart from `FeedAskProjectionTests`, which asks the other half of the same join: which row the
/// live handle belongs to when the record DOES carry one.
@Suite("Feed standing ask")
struct FeedAskStandingTests {
    /// The record and the hook payload arrive independently: Argo holds the question the moment
    /// the hook does, and the CLI writes the call whenever it writes it. A gate holding one over a
    /// reading that carries none is what put `Needs input` on the roster with nothing under it to
    /// answer (#712).
    @Test
    func `a question no row in the reading draws is still put to the reader`() throws {
        let rows = FeedProjection.rows(
            from: [.prompt(text: "/implement 1182", images: [], atMs: nil)],
            asking: FeedAskProjection.asking(for: FeedFixture.askingSession()),
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(ask.isWaiting)
        #expect(ask.ask == FeedFixture.askedLive.ask)
        #expect(ask.live?.askID == "ask-1")
    }

    /// And exactly once: the row the record carries IS the question, so a second copy at the foot
    /// would put the same question to the reader twice.
    @Test
    func `a question the reading already draws is not put a second time`() {
        let rows = FeedProjection.rows(
            from: [.toolCall(FeedFixture.asking(FeedFixture.askedQuestion))],
            asking: FeedAskProjection.asking(for: FeedFixture.askingSession()),
        )

        #expect(FeedFixture.asks(in: rows).map(\.isWaiting) == [true])
    }

    /// The same question, asked TWICE: the record has settled the first asking and has not yet
    /// written the second, which the gate is holding at DIRECT. `offering` leaves a settled row
    /// unclaimed, so `standing` still puts the live one — history above, the question below.
    ///
    /// The case a match on the WORDS would swallow, taking the whole of #1190 with it.
    @Test
    func `a settled row of the same question does not claim the live one`() {
        let rows = FeedProjection.rows(
            from: [
                .toolCall(FeedFixture.asking(FeedFixture.askedQuestion)),
                .toolCallOutcome(TranscriptFixtures.printed("ask", "#712")),
            ],
            asking: FeedAskProjection.asking(for: FeedFixture.askingSession()),
        )

        #expect(FeedFixture.asks(in: rows).map(\.isPending) == [false, true])
        #expect(FeedFixture.asks(in: rows).map(\.isWaiting) == [false, true])
    }
}
