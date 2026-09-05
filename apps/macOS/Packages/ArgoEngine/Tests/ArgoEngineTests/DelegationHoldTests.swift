@testable import ArgoEngine
import Testing

/// One call, of whichever kind, named by its own id so a case can answer it below.
private func call(_ id: String, kind: ToolCallKind = .delegate) -> TranscriptEvent {
    .toolCall(ToolCall(
        id: id,
        name: kind == .delegate ? "Task" : "Bash",
        kind: kind,
        target: nil,
        atMs: nil,
    ))
}

/// A call's answer at whatever status the case is about — `inProgress` is the LAUNCH RECEIPT a
/// backgrounded delegation is answered with at once (#908), and the whole of what this type reads.
private func answer(_ id: String, _ status: ToolCallStatus) -> TranscriptEvent {
    .toolCallOutcome(ToolCallOutcome(
        id: id,
        resolution: ToolCallOutcome.Resolution(status: status, result: nil, endedAtMs: nil),
    ))
}

@Suite("Delegation hold")
struct DelegationHoldTests {
    @Test
    func `a launch receipt with no report leaves the delegation holding the turn`() {
        let hold = DelegationHold.read([call("a"), answer("a", .inProgress)])
        #expect(hold.backgrounded == ["a"])
        #expect(hold.holdsTurn)
    }

    @Test
    func `a reported delegation holds nothing — the report is the call's ending`() {
        let hold = DelegationHold
            .read([call("a"), answer("a", .inProgress), answer("a", .completed)])
        #expect(hold.backgrounded.isEmpty)
        #expect(!hold.holdsTurn)
    }

    @Test
    func `a synchronous delegation is not a hold — no receipt came back to say the parent did`() {
        #expect(!DelegationHold.read([call("a")]).holdsTurn)
    }

    @Test
    func `another call still open beside it is the parent working, so nothing is claimed`() {
        let hold = DelegationHold
            .read([call("a"), answer("a", .inProgress), call("b", kind: .execute)])
        #expect(hold.backgrounded == ["a"])
        #expect(!hold.isAlone)
        #expect(!hold.holdsTurn)
    }

    @Test
    func `that call finishing leaves the delegation alone again`() {
        let hold = DelegationHold.read([
            call("a"), answer("a", .inProgress),
            call("b", kind: .execute), answer("b", .completed),
        ])
        #expect(hold.holdsTurn)
    }

    @Test
    func `a turn boundary clears what it left open — an abandoned call holds nothing`() {
        let hold = DelegationHold
            .read([call("a"), answer("a", .inProgress), .turnEnded(.endTurn)])
        #expect(hold.backgrounded.isEmpty)
        #expect(!hold.holdsTurn)
    }

    @Test
    func `a record with no delegation in it claims nothing about the parent`() {
        #expect(!DelegationHold.read([.message(markdown: "done")]).holdsTurn)
        #expect(!DelegationHold.none.holdsTurn)
    }

    @Test
    func `the reader ending every held delegation is what closes the turn`() {
        let events: [TranscriptEvent] = [
            call("a"), answer("a", .inProgress),
            call("b"), answer("b", .inProgress),
        ]
        let hold = DelegationHold.read(events)
        #expect(hold.backgrounded == ["a", "b"])
        #expect(!DelegationHold.read(events, ended: ["a"]).isEnded)
        #expect(DelegationHold.read(events, ended: ["a", "b"]).isEnded)
    }

    @Test
    func `ending a delegation nothing is holding open closes no turn`() {
        #expect(!DelegationHold.read([call("a")], ended: ["a"]).isEnded)
    }
}
