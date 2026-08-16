import ArgoEngine
@testable import ArgoUI
import Testing

/// What the waiting row is holding, and when the whole call is answered. One `AskUserQuestion` is
/// one thing the agent is waiting on, so nothing goes until every question of it has been settled.
@Suite("Feed ask held")
struct FeedAskHeldTests {
    private static let oneOf = Ask.Question(
        text: "Which ticket?",
        options: Ask.Option.labelled(["#712", "#713"]),
    )
    private static let manyOf = Ask.Question(
        text: "Which gates?",
        options: Ask.Option.labelled(["SwiftLint", "Duplication"]),
        allowsMultiple: true,
    )
    private static let freeForm = Ask.Question(text: "What should I call it?", options: [])

    /// A click on an option is the whole act: no confirm step, and no button to draw.
    @Test
    func `a one-of question is settled by its pick alone`() {
        var held = FeedAskHeld()
        #expect(!held.needsClosing(Self.oneOf, at: 0))
        #expect(!held.isSettled(Self.oneOf, at: 0))

        held[0].ordinals = [1]

        #expect(held.isSettled(Self.oneOf, at: 0))
    }

    /// A second click on a box is a correction rather than a second answer, so the act has to be
    /// closed by something else.
    @Test
    func `a many-of question is not settled until Answer closes it`() {
        var held = FeedAskHeld()
        held[0].ordinals = [1, 2]

        #expect(held.needsClosing(Self.manyOf, at: 0))
        #expect(!held.isSettled(Self.manyOf, at: 0))

        held[0].isClosed = true

        #expect(held.isSettled(Self.manyOf, at: 0))
    }

    @Test
    func `a free-form question draws a field and closes on Answer`() {
        var held = FeedAskHeld()
        held[0].other = "The roll-up"

        #expect(held.needsClosing(Self.freeForm, at: 0))
        #expect(held.hasSomethingToSend(at: 0))
        #expect(!held.isSettled(Self.freeForm, at: 0))

        held[0].isClosed = true

        #expect(held.isSettled(Self.freeForm, at: 0))
    }

    /// Opening `Other` on a one-of question swaps the pick for a field, so the click is no longer
    /// the whole act — the question grows a button it did not have.
    @Test
    func `a one-of question whose Other is open closes on Answer instead`() {
        var held = FeedAskHeld()
        held[0].ordinals = [1]
        held[0].isOtherOpen = true

        #expect(held.needsClosing(Self.oneOf, at: 0))
        #expect(!held.isSettled(Self.oneOf, at: 0))
    }

    @Test
    func `a button with nothing picked and nothing typed has nothing to send`() {
        var held = FeedAskHeld()
        #expect(!held.hasSomethingToSend(at: 0))

        // Whitespace is not an answer.
        held[0].other = "   "
        #expect(!held.hasSomethingToSend(at: 0))

        held[0].other = "and one more"
        #expect(held.hasSomethingToSend(at: 0))
    }

    /// Two questions put by one call are one stop, so the answer waits for both.
    @Test
    func `a call is settled only when every question of it is`() {
        let ask = Ask(questions: [Self.oneOf, Self.oneOf])
        var held = FeedAskHeld()
        held[0].ordinals = [1]

        #expect(!held.isSettled(ask))

        held[1].ordinals = [2]

        #expect(held.isSettled(ask))
    }

    @Test
    func `the answer carries the ordinals the row draws, sorted, one reply per question`() {
        let ask = Ask(questions: [Self.manyOf, Self.oneOf])
        var held = FeedAskHeld()
        held[0].ordinals = [2, 1]
        held[1].ordinals = [1]

        let answer = held.answer(for: ask)

        #expect(answer.replies.map(\.question) == [0, 1])
        #expect(answer.replies.map(\.ordinals) == [[1, 2], [1]])
    }

    /// `Other` carries no ordinal — the feed numbers only what was offered.
    @Test
    func `what was typed travels beside the ordinals, never as one`() throws {
        var held = FeedAskHeld()
        held[0].isOtherOpen = true
        held[0].other = "  Neither — ask me later  "

        let reply = try #require(held.answer(for: Ask(questions: [Self.oneOf])).replies.first)

        #expect(reply.ordinals.isEmpty)
        #expect(reply.other == "  Neither — ask me later  ")
    }

    /// On a one-of question `Other` SWAPS the pick for a field, so going back and clicking an
    /// option must be the whole act it was before — not a gesture that silently does nothing.
    @Test
    func `picking an option again shuts Other and settles the question`() {
        var held = FeedAskHeld()
        held[0].isOtherOpen = true
        #expect(!held.isSettled(Self.oneOf, at: 0))

        // What `FeedAskLine.pick` does on a one-of question.
        held[0].ordinals = [2]
        held[0].isOtherOpen = false

        #expect(held.isSettled(Self.oneOf, at: 0))
    }

    /// Words behind a shut field are kept for a second opening, and are NOT sent beside the choice
    /// that replaced them.
    @Test
    func `words typed under a shut Other do not travel with the pick`() throws {
        var held = FeedAskHeld()
        held[0].other = "something I thought better of"
        held[0].ordinals = [1]

        let reply = try #require(held.answer(for: Ask(questions: [Self.oneOf])).replies.first)

        #expect(reply.ordinals == [1])
        #expect(reply.other == nil)
    }

    @Test
    func `a question answered with nothing typed carries no words`() throws {
        var held = FeedAskHeld()
        held[0].ordinals = [1]
        held[0].other = "   "

        let reply = try #require(held.answer(for: Ask(questions: [Self.oneOf])).replies.first)

        #expect(reply.other == nil)
    }
}
