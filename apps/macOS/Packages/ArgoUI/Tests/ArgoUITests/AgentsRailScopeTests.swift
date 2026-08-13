import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The rail as a CONTROL: which chip can be scoped onto, what the one feed reads once it is, and
/// how
/// the rail's own column answers being collapsed.
@Suite("Agents rail scope")
struct AgentsRailScopeTests {
    private static let reported = Usage(
        inputTokens: 1200,
        outputTokens: 3400,
        cacheReadTokens: 139_000,
        cacheCreationTokens: 0,
    )

    /// The join key, carried from the delegating call's result to the chip. Without it a chip has
    /// no
    /// reading to be scoped onto, whatever else Argo holds.
    @Test
    func `a landed subagent carries the id its result named`() {
        #expect(agents(in: handedOver()).map(\.subagentID) == [nil, "a-back"])
    }

    /// The id arrives WITH the result, so a chip for work still in flight has none — and a rail
    /// full
    /// of running Agents is the state the rail exists for.
    @Test
    func `a subagent still working names no id`() {
        #expect(agents(in: handedOver()).first?.subagentID == nil)
    }

    @Test
    func `an agent whose reading Argo holds is scoped onto its own rows`() throws {
        let landed = try #require(agents(in: handedOver()).last)

        #expect(readings.rows(of: landed)?.map(\.content) == [.message("The fold holds.")])
    }

    /// Degrade-down: no reading is `nil` and not an empty one, because the two are different claims
    /// —
    /// no rows would say the Agent did nothing. It is what keeps the chip a quiet row rather than a
    /// control that empties the feed.
    @Test
    func `an agent Argo has not read scopes onto nothing rather than onto no rows`() throws {
        let running = try #require(agents(in: handedOver()).first)

        #expect(readings.rows(of: running) == nil)
    }

    /// The rail lists the SESSION's Subagents whatever the feed beside it is scoped to. Read off a
    /// scoped feed it would empty itself the moment somebody used it.
    @Test
    func `the rail's agents are the session's, not the scoped reading's`() {
        let session = FeedProjection.rows(from: handedOver())
        let scoped = FeedProjection.rows(from: [.message(markdown: "The fold holds.")])

        #expect(zoning(feed: scoped, agents: FeedAgents.all(in: session)).agents.count == 2)
    }

    /// The strip is narrower than the seam's own floor, which is the whole reason collapsing is not
    /// a drag to the minimum.
    @Test
    func `a collapsed rail takes its strip's width rather than the seam's`() {
        let collapsed = zoning(feed: working, agents: FeedAgents.all(in: working), collapsed: true)

        #expect(collapsed.railWidth == ArgoLayout.agentsRailCollapsedWidth)
        #expect(collapsed.railWidth < ArgoLayout.railWidths.lowerBound)
    }

    /// The lane's share is taken from what the rail leaves, so collapsing the rail has to hand the
    /// width over rather than leave a gap nothing draws.
    ///
    /// Measured at a deck narrow enough that the lane's share is still live: at the window's ideal
    /// width the share is over its ceiling either way, so the widest deck would show nothing move.
    @Test
    func `collapsing the rail gives its width back to the reading`() {
        let agents = FeedAgents.all(in: working)
        let open = zoning(deck: Self.narrowDeck, feed: working, agents: agents)
        let shut = zoning(deck: Self.narrowDeck, feed: working, agents: agents, collapsed: true)

        #expect(shut.laneWidth > open.laneWidth)
    }

    // MARK: - Fixtures

    private let readings = FeedAgentReadings(
        events: ["a-back": [.message(markdown: "The fold holds.")]],
    )

    private func agents(in events: [TranscriptEvent]) -> [FeedAgent] {
        FeedAgents.all(in: FeedProjection.rows(from: events))
    }

    private func handedOver() -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call("away", tool: "Task", kind: .delegate, naming: "review")),
            .toolCall(FeedFixture.call("back", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(FeedFixture.spent("back", Self.reported, subagent: "a-back")),
        ]
    }

    /// A handover the record has not answered, which is a subagent still running — the state that
    /// puts the rail on screen at all.
    private let working = FeedProjection.rows(from: [
        .toolCall(FeedFixture.call("hand", tool: "Task", kind: .delegate, naming: "review")),
    ])

    /// Wide enough for every zone, narrow enough that the lane is still a share rather than sitting
    /// on its ceiling.
    private static let narrowDeck: CGFloat = 900

    private func zoning(
        deck: CGFloat = ArgoLayout.windowIdealWidth,
        feed: [FeedRow],
        agents: [FeedAgent],
        collapsed: Bool = false,
    )
        -> DeckZoning {
        DeckZoning(
            deck: deck,
            feed: feed,
            agents: agents,
            open: nil,
            seams: DeckSeams(
                rail: .constant(ArgoLayout.agentsRailWidth),
                panel: .constant(nil),
            ),
            isRailCollapsed: collapsed,
        )
    }
}
