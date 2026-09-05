import ArgoEngine
@testable import ArgoUI
import Testing

/// What a Subagent's own record says about its run, where the delegation itself said nothing
/// (#1279).
@Suite("Subagent measure")
struct SubagentMeasureTests {
    /// The bug, in one claim: a backgrounded child reports neither figure, and its own file holds
    /// both.
    @Test
    func `a child's own record states a span and a spend`() {
        let measure = SubagentMeasure.read(Self.run)

        #expect(measure.durationMs == 223_591)
        #expect(measure.usage?.billedTokens == 60600)
    }

    /// Degrade down: a child Argo has not read measures nothing. An empty meter is the honest
    /// state, and a zero would claim the work was instant and free.
    @Test
    func `an unread child measures nothing`() {
        let measure = SubagentMeasure.read([])

        #expect(measure.durationMs == nil)
        #expect(measure.usage == nil)
        #expect(measure == .unmeasured)
    }

    /// One dated record is a moment, not a span. `0s` beside a name is a measurement rather than
    /// the absence of one.
    @Test
    func `one moment is no duration`() {
        let measure = SubagentMeasure.read([.prompt(text: "Go", images: [], atMs: 1000)])

        #expect(measure.firstAtMs == 1000)
        #expect(measure.durationMs == nil)
    }

    /// A record priced at nothing and a record nothing priced are two different claims. Only the
    /// first is a figure, and an object naming no term this reader knows is not the first.
    @Test
    func `an unreadable spend is not a spend of zero`() {
        let measure = SubagentMeasure.read([.usage(.unreadable)])

        #expect(measure.usage == nil)
    }

    /// The spend is a ROLL-UP: every assistant record is priced on its own, and what the run cost
    /// is their sum.
    @Test
    func `the spend sums every record the child priced`() {
        let measure = SubagentMeasure.read([
            .usage(Usage(inputTokens: 10, outputTokens: 1, cacheReadTokens: 0,
                         cacheCreationTokens: 0)),
            .usage(Usage(inputTokens: 20, outputTokens: 2, cacheReadTokens: 100,
                         cacheCreationTokens: 7)),
        ])

        #expect(measure.usage?.spentTokens == 33)
        #expect(measure.usage?.billedTokens == 140)
    }

    /// The moments are read off the work as well as the brief. A first-and-last taken off prompts
    /// alone would measure the handover against itself, and a Subagent is prompted once.
    @Test
    func `the span is read off the calls as well as the prompt`() {
        let measure = SubagentMeasure.read([
            .prompt(text: "Sweep the stop reasons", images: [], atMs: 500),
            .toolCall(Self.call(at: 900)),
        ])

        #expect(measure.durationMs == 400)
    }

    /// Out of order is not out of reach: the earliest and the latest are taken by comparison, not
    /// by position, so a record written late about an earlier moment cannot invert the span.
    @Test
    func `the span is the widest pair, whatever order they arrive in`() {
        let measure = SubagentMeasure.read([
            .toolCall(Self.call(at: 4000)),
            .prompt(text: "Go", images: [], atMs: 1000),
            .compaction(atMs: 2500),
        ])

        #expect(measure.firstAtMs == 1000)
        #expect(measure.lastAtMs == 4000)
        #expect(measure.durationMs == 3000)
    }

    private static func call(at atMs: Int) -> ToolCall {
        ToolCall(id: "call-\(atMs)", name: "Read", kind: .read, target: "AgentMeter.swift",
                 atMs: atMs)
    }

    /// One finished background Subagent's own file, as Argo reads it.
    private static let run: [TranscriptEvent] = [
        .prompt(text: "Standards review of #1269", images: [], atMs: 1_700_000_000_000),
        .usage(Usage(inputTokens: 600, outputTokens: 4000, cacheReadTokens: 20000,
                     cacheCreationTokens: 0)),
        .toolCall(call(at: 1_700_000_010_000)),
        .toolCallOutcome(ToolCallOutcome(
            id: "call-1700000010000",
            resolution: ToolCallOutcome.Resolution(status: .completed, result: nil,
                                                   endedAtMs: 1_700_000_012_000),
        )),
        .usage(Usage(inputTokens: 1000, outputTokens: 5000, cacheReadTokens: 30000,
                     cacheCreationTokens: 0)),
        .turnEnded(.endTurn),
        .compaction(atMs: 1_700_000_223_591),
    ]
}
