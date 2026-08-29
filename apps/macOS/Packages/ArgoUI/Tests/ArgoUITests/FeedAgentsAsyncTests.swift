import ArgoEngine
@testable import ArgoUI
import Testing

/// A BACKGROUNDED delegation, which the sync shape's readings all get wrong. The host answers the
/// handover at once with a launch receipt, so the gap between call and result is no longer the
/// child's life — the engine reads the receipt as `inProgress` instead, and everything the rail
/// draws follows from that (#908). What the receipt itself reports is
/// `TaskNotificationReadingTests`.
@Suite("Feed agents launched in the background")
struct FeedAgentsAsyncTests {
    private static let launched: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Agent", kind: .delegate, naming: "review")),
        .toolCallOutcome(ToolCallOutcome(
            id: "away",
            status: .inProgress,
            result: nil,
            endedAtMs: nil,
            usage: nil,
            subagentID: "a-away",
        )),
    ]

    /// The report that ends it, filed as a second outcome for the same call — #825's join, which
    /// this fix leans on to put the rail away again.
    private static let reported = ToolCallOutcome(
        id: "away",
        status: .completed,
        result: nil,
        endedAtMs: nil,
        usage: nil,
        subagentID: "a-away",
    )

    private func rows(_ events: [TranscriptEvent]) -> [FeedRow] {
        FeedProjection.rows(from: events)
    }

    private var rows: [FeedRow] {
        rows(Self.launched)
    }

    private func zoning(_ events: [TranscriptEvent]) -> DeckZoning {
        DeckZoning(
            deck: 1400,
            feed: rows(events),
            agents: FeedAgents.all(in: rows(events)),
            open: nil,
            seams: .unheld,
        )
    }

    @Test
    func `a launch receipt leaves the subagent running`() {
        #expect(FeedAgents.all(in: rows).map(\.isRunning) == [true])
        #expect(FeedAgents.running(in: rows) == 1)
    }

    /// Which is the whole bug: a rail that never appears while three agents are working.
    @Test
    func `a session whose agents were all launched in the background still shows the rail`() {
        #expect(zoning(Self.launched).showsRail)
    }

    /// And the other half of it: the rail is a claim about NOW, so the report landing must take it
    /// away again rather than leaving a fan-out on screen for the rest of the session.
    @Test
    func `the rail goes away when the last report lands`() {
        let ended = Self.launched + [.toolCallOutcome(Self.reported)]

        #expect(FeedAgents.running(in: rows(ended)) == 0)
        #expect(!zoning(ended).showsRail)
    }
}
