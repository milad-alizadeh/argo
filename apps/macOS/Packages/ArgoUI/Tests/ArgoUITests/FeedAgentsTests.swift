import ArgoEngine
@testable import ArgoUI
import Testing

/// Who else is working, read off the same rows the reader is looking at. The claims here are about
/// the rail and the count in its header being ONE reading: a list and a count that can disagree is
/// a rail standing empty over "2 running".
@Suite("Feed agents")
struct FeedAgentsTests {
    private func agents(in events: [TranscriptEvent]) -> [FeedAgent] {
        FeedAgents.all(in: FeedProjection.rows(from: events))
    }

    /// The parent writes the call when it hands the work over and the result when it comes back, so
    /// the gap between them is the child's whole life.
    @Test
    func `a delegation the record has not answered is a subagent still running`() {
        let chips = agents(in: handedOver())

        #expect(chips.map(\.isRunning) == [true, false])
        #expect(FeedAgents.running(in: FeedProjection.rows(from: handedOver())) == 1)
    }

    @Test
    func `a subagent is named by the brief it was handed`() {
        #expect(agents(in: handedOver()).map(\.label) == ["review", "verify"])
    }

    @Test
    func `a session that delegated nothing has no subagents`() {
        let looking: [TranscriptEvent] = [
            .toolCall(FeedFixture.call("look", tool: "Read", kind: .read, naming: "a.swift")),
            .toolCallOutcome(FeedFixture.answered("look", nil)),
        ]

        #expect(agents(in: looking).isEmpty)
        #expect(FeedAgents.running(in: FeedProjection.rows(from: looking)) == 0)
    }

    /// Nothing is reported until the delegating call comes back.
    @Test
    func `a subagent still working reports no spend`() {
        #expect(agents(in: handedOver()).first?.spend == nil)
    }

    @Test
    func `a landed subagent carries what its result reported spending`() {
        #expect(agents(in: handedOver()).last?.spend == Self.reported)
    }

    /// Two agents handed the same brief are two agents: folding them would report a run as finished
    /// when only the second had, with one child's spend read against both.
    @Test
    func `two subagents handed the same brief are two chips, never one`() {
        #expect(agents(in: sameBrief()).count == 2)
    }

    @Test
    func `two subagents handed the same brief keep their own endings and spends`() {
        let chips = agents(in: sameBrief())

        #expect(chips.map(\.isRunning) == [true, false])
        #expect(chips.map(\.spend) == [nil, Self.reported])
    }

    /// The rail reads off the rows, so the rows may not fuse them either: `Delegated verify ×2`
    /// would report one handover where two happened.
    @Test
    func `two subagents handed the same brief keep their own rows`() {
        let handovers = FeedFixture.calls(in: sameBrief()).filter { $0.kind == .delegate }

        #expect(handovers.map(\.repeats) == [1, 1])
    }

    private func sameBrief() -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call("one", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCall(FeedFixture.call("two", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(FeedFixture.spent("two", Self.reported)),
        ]
    }

    private static let reported = Usage(
        inputTokens: 1200,
        outputTokens: 3400,
        cacheReadTokens: 139_000,
        cacheCreationTokens: 0,
    )

    private func handedOver() -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call("away", tool: "Task", kind: .delegate, naming: "review")),
            .toolCall(FeedFixture.call("back", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(FeedFixture.spent("back", Self.reported)),
        ]
    }
}
