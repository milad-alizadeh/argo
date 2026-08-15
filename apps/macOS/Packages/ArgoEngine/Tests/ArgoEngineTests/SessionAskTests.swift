@testable import ArgoEngine
import Testing

/// The hook's payload read into the live ask: the questions verbatim, their options in the order
/// they were offered, and nothing invented for a payload that is not one of these.
@Suite("Session ask")
struct SessionAskTests {
    private func read(_ line: String) -> SessionAsk? {
        SessionAsk(line: line, id: "ask-1")
    }

    @Test
    func `a one-of question carries its options in the order they were offered`() throws {
        let line = """
        {"tool_name":"AskUserQuestion","tool_input":{"questions":[{\
        "question":"Which ticket should I implement?","header":"Ticket","multiSelect":false,\
        "options":[{"label":"#712","description":"Open, closest to this worktree."},\
        {"label":"#713","description":"Open, the other recent one."}]}]}}
        """
        let ask = try #require(read(line))
        let question = try #require(ask.ask.questions.first)

        #expect(ask.id == "ask-1")
        #expect(question.text == "Which ticket should I implement?")
        #expect(question.allowsMultiple == false)
        #expect(question.options == [
            Ask.Option(label: "#712", detail: "Open, closest to this worktree."),
            Ask.Option(label: "#713", detail: "Open, the other recent one."),
        ])
    }

    @Test
    func `a many-of question says so, so the row can draw boxes rather than a pick`() throws {
        let line = """
        {"tool_name":"AskUserQuestion","tool_input":{"questions":[{\
        "question":"Which gates should run?","multiSelect":true,\
        "options":[{"label":"SwiftLint"},{"label":"Duplication"}]}]}}
        """
        let question = try #require(read(line)?.ask.questions.first)

        #expect(question.allowsMultiple)
        // An option the host offered no line under is a label alone, never a blank second line.
        #expect(question.options == [
            Ask.Option(label: "SwiftLint", detail: nil),
            Ask.Option(label: "Duplication", detail: nil),
        ])
    }

    @Test
    func `a question offering nothing is free-form, not a question that could not be read`() throws {
        let line = """
        {"tool_name":"AskUserQuestion","tool_input":{"questions":[\
        {"question":"What should I call the roll-up?"}]}}
        """
        let question = try #require(read(line)?.ask.questions.first)

        #expect(question.options.isEmpty)
        #expect(question.allowsMultiple == false)
    }

    @Test
    func `one call carries every question it put, in order`() throws {
        let line = """
        {"tool_name":"AskUserQuestion","tool_input":{"questions":[\
        {"question":"Where does the answer go?"},{"question":"What does esc do?"}]}}
        """
        let ask = try #require(read(line))

        #expect(ask.ask.questions.map(\.text) == ["Where does the answer go?", "What does esc do?"])
    }

    @Test
    func `only that tool raises an ask, and only when its input holds a question`() {
        #expect(read(#"{"tool_name":"Bash","tool_input":{"command":"ls"}}"#) == nil)
        #expect(read(#"{"tool_name":"AskUserQuestion","tool_input":{"questions":[]}}"#) == nil)
        #expect(read(#"{"tool_name":"AskUserQuestion","tool_input":{}}"#) == nil)
        #expect(read("not json") == nil)
    }
}
