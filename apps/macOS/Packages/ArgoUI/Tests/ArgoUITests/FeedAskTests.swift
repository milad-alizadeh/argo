import ArgoEngine
@testable import ArgoUI
import Testing

/// The one row in the feed that is about somebody rather than about the agent. Every claim here is
/// about the difference between a question still waiting on you and one already settled — which is
/// the difference between a row that may take the attention ink and one that may not.
@Suite("Feed ask")
struct FeedAskTests {
    private static let question = Ask.Question(
        text: "Which ink does a prompt still waiting take?",
        options: ["The attention ink", "The ordinary ink"],
    )

    /// The pair a transcript writes: the question, and — where somebody answered — the result that
    /// came back for it some records later.
    private func asked(_ answer: String?) -> FeedAsk? {
        var events: [TranscriptEvent] = [.toolCall(FeedFixture.asking(Self.question))]
        if let answer {
            events.append(.toolCallOutcome(FeedFixture.answered("ask", .output(
                OutputEvidence(tier: .direct, text: answer),
            ))))
        }
        return FeedFixture.asks(in: FeedProjection.rows(from: events)).first
    }

    @Test
    func `a question the record has not answered is still waiting`() throws {
        let ask = try #require(asked(nil))

        #expect(ask.isPending)
        #expect(ask.chosen(in: Self.question) == nil)
    }

    /// Verbatim, and that is the whole claim: what is on screen is what was offered, in the order
    /// it was offered, because somebody is about to choose between them.
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

    /// The reading is that the answer NAMES an option. Where it names none, nothing is marked — a
    /// tick against an option nobody chose is a worse row than a row with no tick on it.
    @Test
    func `an answer naming none of the options marks nothing`() throws {
        let ask = try #require(asked("neither, ask me again"))

        #expect(ask.chosen(in: Self.question) == nil)
    }

    /// Somebody replied. What they replied with being unreadable is a different failure from
    /// nobody having replied at all, and ambiguity resolves toward the quieter state — so the row
    /// stops asking for attention rather than glowing forever over a settled question.
    @Test
    func `a question answered with nothing readable has still stopped waiting`() throws {
        let rows = FeedProjection.rows(from: [
            .toolCall(FeedFixture.asking(Self.question)),
            .toolCallOutcome(FeedFixture.answered("ask", nil)),
        ])
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(!ask.isPending)
        #expect(ask.chosen(in: Self.question) == nil)
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
