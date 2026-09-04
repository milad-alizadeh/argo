import ArgoEngine
import ArgoFixtures
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
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: "a-away")),
    ]

    /// The report that ends it, filed as a second outcome for the same call — #825's join, which
    /// this fix leans on to put the rail away again.
    private static let reported = ToolCallOutcome(
        id: "away",
        resolution: ToolCallOutcome.Resolution(status: .completed, result: nil, endedAtMs: nil),
        delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: "a-away"),
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
            agents: FeedAgents.all(in: rows(events), of: .running),
            open: nil,
            seams: .unheld,
        )
    }

    @Test
    func `a launch receipt leaves the subagent running`() {
        let chips = FeedAgents.all(in: rows, of: .running)

        #expect(chips.map(\.activity) == [.running])
        #expect(FeedAgents.running(of: chips) == 1)
    }

    /// Which is the whole bug: a rail that never appears while three agents are working.
    @Test
    func `a session whose agents were all launched in the background still shows the rail`() {
        #expect(zoning(Self.launched).showsRail)
    }

    /// And the other half of it: the COUNT LINE is the claim about now, so the report landing has
    /// to retire the chip rather than leave a fan-out running for the rest of the session. The rail
    /// itself stays — it lists what this Session delegated, finished chips included, and leaving
    /// with the last report would take the way back out of a scoped feed with it (#1076).
    @Test
    func `the last report retires the chip and leaves the rail standing`() {
        let ended = Self.launched + [.toolCallOutcome(Self.reported)]

        #expect(FeedAgents.running(of: FeedAgents.all(in: rows(ended), of: .running)) == 0)
        #expect(zoning(ended).showsRail)
    }
}
