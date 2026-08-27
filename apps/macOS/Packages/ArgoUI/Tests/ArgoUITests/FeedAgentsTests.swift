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
            .toolCallOutcome(TranscriptFixtures.finished("look", nil)),
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

    /// The host measures the child's whole run and states it on the record that answers the
    /// handover — the same record the spend arrives on, and the only place either is ever reported.
    @Test
    func `a landed subagent carries how long its result reported running`() {
        #expect(agents(in: timed()).last?.durationMs == 96400)
    }

    /// It has no total to draw, so the chip counts up from the handover instead. The moment is the
    /// delegating call's own, which is when the work left.
    @Test
    func `a subagent still working reports no duration and keeps the moment it was handed over`() {
        let running = agents(in: timed()).first

        #expect(running?.durationMs == nil)
        #expect(running?.startedAtMs == 1_733_000_000_000)
    }

    /// The rail's join key onto a Subagent's own record, carried from the result that named it. A
    /// chip without one has no reading to be scoped onto, whatever else Argo holds.
    @Test
    func `a landed subagent carries the id its result named`() {
        #expect(agents(in: FeedFixture.handedOver(subagent: "a-back")).map(\.subagentID)
            == [nil, "a-back"])
    }

    /// The id arrives WITH the result, so a chip for work still in flight has none — and a rail
    /// full of running Agents is the state the rail exists for.
    @Test
    func `a subagent still working names no id`() {
        #expect(agents(in: FeedFixture.handedOver(subagent: "a-back")).first?.subagentID == nil)
    }

    private func timed() -> [TranscriptEvent] {
        [
            .toolCall(ToolCall(
                id: "away", name: "Task", kind: .delegate, target: "review",
                atMs: 1_733_000_000_000,
            )),
            .toolCall(FeedFixture.call("back", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(ToolCallOutcome(
                id: "back",
                status: .completed,
                result: nil,
                endedAtMs: nil,
                usage: Self.reported,
                reportedDurationMs: 96400,
            )),
        ]
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
            .toolCallOutcome(TranscriptFixtures.spent("two", Self.reported)),
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
            .toolCallOutcome(TranscriptFixtures.spent("back", Self.reported)),
        ]
    }
}
