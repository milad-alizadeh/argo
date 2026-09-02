import ArgoEngine
import ArgoFixtures
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// The one row in the feed that is about somebody rather than the agent. Every claim here is about
/// the difference between a question still waiting and one already settled.
@Suite("Feed ask")
struct FeedAskTests {
    private static let question = Ask.Question(
        text: "Which ink does a prompt still waiting take?",
        options: Ask.Option.labelled(["The attention ink", "The ordinary ink"]),
    )

    /// The pair a transcript writes: the question, and — where somebody answered — the result that
    /// came back for it some records later.
    private func asked(_ answer: String?) -> FeedAsk? {
        var events: [TranscriptEvent] = [.toolCall(FeedFixture.asking(Self.question))]
        if let answer {
            events.append(.toolCallOutcome(TranscriptFixtures.printed("ask", answer)))
        }
        return FeedFixture.asks(in: FeedProjection.rows(from: events)).first
    }

    @Test
    func `a question the record has not answered is still waiting`() throws {
        let ask = try #require(asked(nil))

        #expect(ask.isPending)
        #expect(ask.chosen(in: Self.question) == nil)
    }

    /// Verbatim: what is on screen is what was offered, in the order it was offered.
    @Test
    func `a question carries the options exactly as they were offered`() throws {
        let ask = try #require(asked(nil))

        #expect(ask.ask.questions == [Self.question])
    }

    @Test
    func `an answered question is no longer waiting`() throws {
        let ask = try #require(asked("The ordinary ink"))

        #expect(!ask.isPending)
    }

    @Test
    func `an answered question marks the option that was chosen`() throws {
        let ask = try #require(asked(
            "Your questions have been answered: \"Which ink?\"=\"The attention ink\"",
        ))

        #expect(ask.chosen(in: Self.question) == "The attention ink")
    }

    /// The reading is that the answer NAMES an option; where it names none, nothing is chosen.
    @Test
    func `an answer naming none of the options chooses nothing`() throws {
        let ask = try #require(asked("neither, ask me again"))

        #expect(ask.chosen(in: Self.question) == nil)
    }

    /// Somebody replied, and ambiguity resolves toward the quieter state: an unreadable answer
    /// still stops the row asking for attention.
    @Test
    func `a question answered with nothing readable has still stopped waiting`() throws {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.asking(Self.question)),
            .toolCallOutcome(TranscriptFixtures.finished("ask", nil)),
        ])
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(!ask.isPending)
        #expect(ask.chosen(in: Self.question) == nil)
    }

    /// The prompt offers a numbered list and the answer names an option by that number, so the row
    /// has to spell the same numbers the terminal did.
    @Test
    func `the options are numbered from one, in the order they were offered`() throws {
        let ask = try #require(asked(nil))

        let offers = ask.offers(in: Self.question)

        #expect(offers.map(\.ordinal) == [1, 2])
        #expect(offers.map(\.label) == Self.question.options.map(\.label))
        #expect(offers.map(\.marker) == ["1.", "2."])
    }

    @Test
    func `the option the answer named is the only one chosen`() throws {
        let ask = try #require(asked("The ordinary ink"))

        #expect(ask.offers(in: Self.question).map(\.isChosen) == [false, true])
    }

    /// The state that matters: every option still carries its ordinal, and none carries the mark.
    @Test
    func `a question nobody has answered marks none of its options`() throws {
        let ask = try #require(asked(nil))

        #expect(ask.offers(in: Self.question).allSatisfy { !$0.isChosen })
    }

    /// An answer names WORDS, and two options may carry the same words. It has named one of them.
    @Test
    func `two options with the same words mark only the first`() {
        let offers = FeedAskOffer.numbered(Ask.Option.labelled(["Yes", "Yes"]), chosen: "Yes")

        #expect(offers.map(\.isChosen) == [true, false])
    }

    @Test
    func `a question that offered nothing offers nothing`() throws {
        let ask = try #require(asked(nil))

        #expect(ask.offers(in: Ask.Question(text: "Name it?", options: [])).isEmpty)
    }

    @Test
    func `a question stays where it was asked, never pinned or promoted`() {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.asking(Self.question)),
            .message(markdown: "Waiting on you."),
        ])

        #expect(rows.count == 2)
        #expect(rows.last?.content == .message("Waiting on you."))
    }

    /// A call named for the question tool whose input carried nothing readable is still a call. It
    /// happened; what it asked is what the record did not say.
    @Test
    func `a question with no words in it stays an ordinary call line`() {
        let rows = FeedProjection.rows(from: [
            .toolCall(ToolCall(
                id: "ask",
                name: ToolCall.askUserQuestion,
                kind: .other,
                target: nil,
                atMs: nil,
            )),
        ])

        #expect(FeedFixture.asks(in: rows).isEmpty)
        #expect(rows.count == 1)
    }
}
