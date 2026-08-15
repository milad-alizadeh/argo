@testable import ArgoEngine
import Testing

/// What goes back down the socket when somebody answers. The whole claim of this suite is that the
/// agent reads the answer to the question it asked — named by the question's own words, because a
/// call carrying two questions numbers both from 1 and an ordinal alone names nothing.
@Suite("Ask reply")
struct AskReplyTests {
    private let ask = SessionAsk(id: "ask-1", ask: Ask(questions: [
        Ask.Question(
            text: "Where should the ask take its answer?",
            options: [
                Ask.Option(label: "In the feed, where it was asked"),
                Ask.Option(label: "In the composer's slot"),
            ],
        ),
        Ask.Question(
            text: "What does esc do on an ask?",
            options: [Ask.Option(label: "Nothing"), Ask.Option(label: "Clears the selection")],
            allowsMultiple: true,
        ),
    ]))

    private func reason(_ replies: AskAnswer.Reply...) -> String {
        AskReply.line(for: ask, answering: AskAnswer(replies: replies))
    }

    @Test
    func `an ordinal is spelled with the words it was offered under`() {
        let line = reason(AskAnswer.Reply(question: 0, ordinals: [1]))

        #expect(line.contains("Where should the ask take its answer?"))
        #expect(line.contains("1. In the feed, where it was asked"))
    }

    @Test
    func `a many-of answer names every option it ticked, in the order they were offered`() throws {
        let line = reason(AskAnswer.Reply(question: 1, ordinals: [2, 1]))
        let first = try #require(line.range(of: "1. Nothing"))
        let second = try #require(line.range(of: "2. Clears the selection"))

        #expect(first.lowerBound < second.lowerBound)
    }

    /// `Other` carries no number: the feed numbers only what was OFFERED, so a numbered `Other`
    /// would put the ordinals one past the ones the answer names.
    @Test
    func `what was typed instead carries no ordinal`() {
        let line = reason(AskAnswer.Reply(question: 0, other: "Neither — put it in the header"))

        #expect(line.contains("Neither — put it in the header"))
        #expect(!line.contains("3."))
    }

    @Test
    func `a question answered with nothing says so rather than going silent`() {
        let line = reason(AskAnswer.Reply(question: 1, ordinals: []))

        #expect(line.contains("What does esc do on an ask?"))
        #expect(line.lowercased().contains("no option"))
    }

    /// The answer names what was offered. An ordinal outside the list names nothing, and inventing
    /// an option for it would answer on somebody else's behalf.
    @Test
    func `an ordinal nothing was offered under is dropped`() {
        let line = reason(AskAnswer.Reply(question: 0, ordinals: [1, 9]))

        #expect(line.contains("1. In the feed, where it was asked"))
        #expect(!line.contains("9."))
    }

    @Test
    func `a reply for a question the call never put is dropped`() {
        #expect(!reason(AskAnswer.Reply(question: 7, ordinals: [1])).contains("7"))
    }

    /// The whole line is a hook reply, and the vocabulary has no word for "here is your answer" —
    /// so it is a `deny` whose reason IS the answer, and the tool never runs its own picker.
    @Test
    func `the answer travels as the reply the hook has a word for`() throws {
        let line = reason(AskAnswer.Reply(question: 0, ordinals: [1]))
        let payload = try #require(JSONValue.record(fromLine: line))
        let output = try #require(payload["hookSpecificOutput"])

        #expect(output.stringField("hookEventName") == "PreToolUse")
        #expect(output.stringField("permissionDecision") == "deny")
        #expect(output.stringField("permissionDecisionReason")?.isEmpty == false)
    }

    /// One line, because the socket frames on newlines — an answer spanning two would be read as
    /// two replies, and the second would arrive at whatever asked next.
    @Test
    func `the reply is one line however many questions were answered`() {
        let line = reason(
            AskAnswer.Reply(question: 0, ordinals: [1]),
            AskAnswer.Reply(question: 1, ordinals: [1], other: "and something else"),
        )

        #expect(!line.contains("\n"))
    }
}
