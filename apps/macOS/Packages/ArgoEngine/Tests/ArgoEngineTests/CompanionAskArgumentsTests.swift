@testable import ArgoEngine
import Testing

/// What the channel accepts as a QUESTION, read at the boundary (#1205).
///
/// The transcript channel already refuses a call named for the ask tool whose input carried no
/// readable question (`AskReading`) — a question with no words is not one anybody can answer. The
/// plugin channel had no such rule, and the row #1205 added would have drawn the empty result of
/// it at the foot of the reading.
@Suite("Companion ask arguments")
struct CompanionAskArgumentsTests {
    private func fact(question: JSONValue, options: JSONValue? = nil) -> CompanionFact? {
        var arguments: [String: JSONValue] = ["question": question]
        arguments["options"] = options
        return CompanionArguments.fact(
            for: .askUser,
            from: .object(arguments),
            callID: .string("call-1"),
        )
    }

    private func asked(_ fact: CompanionFact?) -> CompanionAsk? {
        guard case let .ask(ask) = fact else { return nil }
        return ask
    }

    @Test
    func `a question with words is read`() {
        #expect(asked(fact(question: .string("Which branch?")))?.question == "Which branch?")
    }

    /// The agent gets a refusal rather than the cockpit getting an invented question — the rule
    /// every read in `CompanionArguments` already follows.
    @Test
    func `a question with no words is refused`() {
        #expect(fact(question: .string("")) == nil)
    }

    @Test
    func `a question that is not a string at all is refused`() {
        #expect(fact(question: .number(7)) == nil)
    }

    /// One at a time rather than all of them: an option with nothing on it would draw as a number
    /// beside empty space, and the question is still answerable without it.
    @Test
    func `a blank option is dropped and the rest are kept`() {
        let read = asked(fact(
            question: .string("Which branch?"),
            options: .array([.string("main"), .string(""), .string("the ticket branch")]),
        ))

        #expect(read?.options == ["main", "the ticket branch"])
    }
}
