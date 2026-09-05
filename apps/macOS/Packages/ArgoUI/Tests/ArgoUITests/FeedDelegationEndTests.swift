import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The end of a delegation, as its own row in the reading (#1281). The feed showed when a Subagent
/// started and never when one stopped, so the reader had to open the rail or read the parent's
/// prose to learn the children had come back.
@Suite("Feed delegation endings")
struct FeedDelegationEndTests {
    private static let spend = TranscriptFixtures.subagentSpend

    private func rows(_ events: [TranscriptEvent]) -> [FeedRow] {
        FeedProjection.rows(from: events)
    }

    private func endings(in events: [TranscriptEvent]) -> [FeedDelegationEnd] {
        rows(events).compactMap { row in
            guard case let .delegationEnded(end) = row.content else { return nil }
            return end
        }
    }

    private static func handedOver(_ id: String, naming brief: String) -> TranscriptEvent {
        .toolCall(FeedFixture.call(id, tool: "Task", kind: .delegate, naming: brief))
    }

    @Test
    func `a delegation that resolves lands a row where it resolved`() {
        let events: [TranscriptEvent] = [
            Self.handedOver("standards", naming: "Standards review"),
            .message(markdown: "Both review axes are running. Waiting for results."),
            .toolCallOutcome(TranscriptFixtures.spent("standards", Self.spend, reportedMs: 94000)),
            .message(markdown: "Standards came back clean."),
        ]

        let shapes = rows(events).map(\.content.shape)

        #expect(shapes == [.call, .message, .delegationEnded, .message])
    }

    /// Two Subagents, two endings, each naming its own brief — the whole point of the row: a reader
    /// holding two `Delegated` lines has to be told WHICH of them came back.
    @Test
    func `each ending names the delegation it ended`() {
        let events: [TranscriptEvent] = [
            Self.handedOver("standards", naming: "Standards review"),
            Self.handedOver("spec", naming: "Spec review"),
            .toolCallOutcome(TranscriptFixtures.spent("spec", Self.spend)),
            .toolCallOutcome(TranscriptFixtures.spent("standards", Self.spend)),
        ]

        #expect(endings(in: events).map(\.label) == ["Spec review", "Standards review"])
    }

    @Test
    func `the row carries what the record reported`() throws {
        let events = [
            Self.handedOver("standards", naming: "Standards review"),
            .toolCallOutcome(TranscriptFixtures.spent("standards", Self.spend, reportedMs: 94000)),
        ]

        let end = try #require(endings(in: events).first)

        #expect(end.durationMs == 94000)
        #expect(end.spend == Self.spend)
        #expect(end.ending == .succeeded)
    }

    /// #908: a backgrounded Agent reports neither figure at either end. The row still lands, and it
    /// says nothing it cannot prove rather than drawing a `0` for either.
    @Test
    func `an agent that reported neither figure still gets a row`() {
        let events: [TranscriptEvent] = [
            Self.handedOver("away", naming: "Sweep the stop reasons"),
            .toolCallOutcome(TranscriptFixtures.launched("away", subagent: "a-away")),
            .toolCallOutcome(ToolCallOutcome(
                id: "away",
                resolution: ToolCallOutcome.Resolution(
                    status: .completed, result: nil, endedAtMs: nil,
                ),
                delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: "a-away"),
            )),
        ]

        let ended = endings(in: events)

        #expect(ended.count == 1)
        #expect(ended.first?.durationMs == nil)
        #expect(ended.first?.spend == nil)
    }

    /// The launch receipt resolves nothing (#908), so it writes no ending — the report that lands
    /// later is what closes the delegation, and the row goes at that moment and not at the receipt.
    @Test
    func `a launch receipt writes no ending`() {
        let events: [TranscriptEvent] = [
            Self.handedOver("away", naming: "Sweep the stop reasons"),
            .toolCallOutcome(TranscriptFixtures.launched("away", subagent: "a-away")),
        ]

        #expect(endings(in: events).isEmpty)
    }

    /// #1076 and #1090: Argo does not invent an ending it cannot see. A delegation the record never
    /// answered writes nothing here, however long ago it was handed over.
    @Test
    func `a delegation nothing closes writes no ending`() {
        #expect(endings(in: [Self.handedOver("open", naming: "Research the ink")]).isEmpty)
    }

    @Test
    func `a delegation that failed reads as failed`() throws {
        let events = [
            Self.handedOver("spec", naming: "Spec review"),
            .toolCallOutcome(FeedFixture.failed("spec", printing: "the subagent exited")),
        ]

        let end = try #require(endings(in: events).first)

        #expect(end.ending == .failed)
        #expect(end.ink == .failure)
        #expect(end.spoken.contains("failed"))
    }

    /// The row opens nothing and stands for no call: what the Subagent produced is behind the
    /// `Delegated` line that handed the work over, and a second door onto it would be a second
    /// answer to one question.
    @Test
    func `the ending is a call-shaped row that opens nothing`() {
        let events = [
            Self.handedOver("standards", naming: "Standards review"),
            .toolCallOutcome(TranscriptFixtures.spent("standards", Self.spend)),
        ]
        let row = rows(events).last

        #expect(row?.kind.isCall == true)
        #expect(row?.kind.opensEvidence == false)
        #expect(row?.kind.activation == .inert)
        #expect(row?.content.calls.isEmpty == true)
    }

    /// The rail counts delegations off the `Delegated` rows, so an ending must not read as a second
    /// handover — two chips for one Subagent is the disagreement #1269 closed.
    @Test
    func `an ending is not counted as a second subagent`() {
        let events = [
            Self.handedOver("standards", naming: "Standards review"),
            .toolCallOutcome(TranscriptFixtures.spent("standards", Self.spend)),
        ]

        #expect(FeedAgents.all(in: rows(events), of: .running).count == 1)
    }

    /// Quiet folding treats it as it treats the `Delegated` row it answers: a loud row, which
    /// breaks a run of looking rather than disappearing into a count that would take its label
    /// away.
    @Test
    func `the quiet fold breaks on an ending`() {
        // The handover is at the head, so the ONLY thing standing between the two runs of looking
        // is the row this ticket adds — four reads under one delegation fold into one survey
        // without it.
        let events = [Self.handedOver("standards", naming: "Standards review")]
            + Self.read("a.swift", "b.swift")
            + [.toolCallOutcome(TranscriptFixtures.spent("standards", Self.spend))]
            + Self.read("c.swift", "d.swift")

        #expect(FeedFixture.surveys(in: rows(events)).map(\.calls.count) == [2, 2])
    }

    /// A run of reads the record answered with output, which is what the quiet fold gathers.
    private static func read(_ paths: String...) -> [TranscriptEvent] {
        paths.flatMap { path -> [TranscriptEvent] in
            [
                .toolCall(FeedFixture.call(
                    "read-\(path)",
                    tool: "Read",
                    kind: .read,
                    naming: path,
                )),
                .toolCallOutcome(TranscriptFixtures.printed("read-\(path)", "let token = 1")),
            ]
        }
    }
}
