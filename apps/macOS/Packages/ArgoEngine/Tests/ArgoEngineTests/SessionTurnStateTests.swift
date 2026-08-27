@testable import ArgoEngine
import Testing

/// The Turn in flight. Every rule here was previously spelled inside `HubSession.apply` and
/// `mergeContinuation`, and the resume rule below had no test at all.
@Suite("Session turn state")
struct SessionTurnStateTests {
    @Test
    func `an ended Turn is no longer open`() {
        var turn = SessionTurnState()
        turn.opened()

        turn.ended(.endTurn)

        #expect(!turn.isOpen)
    }

    @Test
    func `an ended Turn keeps the reason it ended with`() {
        var turn = SessionTurnState()
        turn.opened()

        turn.ended(.refusal)

        #expect(turn.lastStop == .refusal)
    }

    @Test
    func `ending the Turn drops the questions it left behind`() {
        var turn = SessionTurnState()
        turn.opened()
        turn.observe(.testCall(id: "ask-1"))

        turn.ended(.endTurn)

        #expect(!turn.hasPendingAsk)
    }

    @Test
    func `an AskUserQuestion call makes the Turn wait for an answer`() {
        var turn = SessionTurnState()

        turn.observe(.testCall(id: "ask-1"))

        #expect(turn.hasPendingAsk)
    }

    @Test
    func `any other call leaves the Turn waiting on nobody`() {
        var turn = SessionTurnState()

        turn.observe(.testCall(id: "read-1", name: "Read"))

        #expect(!turn.hasPendingAsk)
    }

    @Test
    func `a Turn with one question still unanswered keeps waiting`() {
        var turn = SessionTurnState()
        turn.observe(.testCall(id: "ask-1"))
        turn.observe(.testCall(id: "ask-2"))

        turn.answered("ask-1")

        #expect(turn.hasPendingAsk)
    }

    @Test
    func `answering every question stops the Turn waiting`() {
        var turn = SessionTurnState()
        turn.observe(.testCall(id: "ask-1"))
        turn.observe(.testCall(id: "ask-2"))

        turn.answered("ask-1")
        turn.answered("ask-2")

        #expect(!turn.hasPendingAsk)
    }

    /// A resume file with no Turn in it yet would otherwise close the root's open Turn.
    @Test
    func `a continuation that has said nothing leaves the Turn open`() {
        var turn = SessionTurnState()
        turn.opened()

        turn.merge(SessionTurnState())

        #expect(turn.isOpen)
    }

    @Test
    func `a continuation that has said nothing leaves its questions waiting`() {
        var turn = SessionTurnState()
        turn.opened()
        turn.observe(.testCall(id: "ask-1"))

        turn.merge(SessionTurnState())

        #expect(turn.hasPendingAsk)
    }

    @Test
    func `a continuation that opened a Turn replaces the one it continues`() {
        var turn = SessionTurnState()
        turn.opened()
        turn.ended(.endTurn)
        var continuation = SessionTurnState()
        continuation.opened()

        turn.merge(continuation)

        #expect(turn.isOpen)
        #expect(turn.lastStop == nil)
    }

    @Test
    func `a continuation that ended a Turn replaces the reason`() {
        var turn = SessionTurnState()
        turn.opened()
        turn.ended(.endTurn)
        var continuation = SessionTurnState()
        continuation.ended(.cancelled)

        turn.merge(continuation)

        #expect(turn.lastStop == .cancelled)
    }
}

extension ToolCall {
    /// A call carrying nothing but the two fields the Turn reads off it.
    static func testCall(id: String, name: String = ToolCall.askUserQuestion) -> ToolCall {
        ToolCall(id: id, name: name, kind: .other, target: nil, atMs: nil)
    }
}
