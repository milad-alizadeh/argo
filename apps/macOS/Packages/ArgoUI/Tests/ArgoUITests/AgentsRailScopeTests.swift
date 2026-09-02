import ArgoDesign
import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Foundation
import Testing

/// The rail as a CONTROL: which chip can be scoped onto, what the one feed reads once it is, and
/// how the rail's own column answers being collapsed.
///
/// What a chip SAYS is `FeedAgentsTests` — the projection's claims stay there, so the two suites do
/// not both own the same fact.
@Suite("Agents rail scope")
@MainActor
struct AgentsRailScopeTests {
    @Test
    func `an agent whose reading Argo holds is scoped onto its own rows`() throws {
        let landed = try #require(agents(in: FeedFixture.handedOver(subagent: Self.read)).last)

        #expect(readings.rows(of: landed)?.map(\.content) == [.message(Self.said)])
    }

    /// Degrade-down: no reading is `nil` and not an empty one, because the two are different claims
    /// — no rows would say the Agent did nothing. It is what keeps the chip a quiet row rather than
    /// a control that empties the feed.
    @Test
    func `an agent Argo has not read scopes onto nothing rather than onto no rows`() throws {
        let running = try #require(agents(in: FeedFixture.handedOver()).first)

        #expect(readings.rows(of: running) == nil)
    }

    /// The rail lists what the Session delegated, finished chips included — so the chip a reader
    /// clicks after the work landed still scopes the feed onto its reading, in a Session that has
    /// stopped running. Keyed on "something is running", this fell back to the Session's own feed
    /// the moment the dots went honest (#1076).
    @Test
    func `a scope on an agent whose work has landed still draws that agent's rows`() {
        let landed = FeedProjection.rows(from: settled())

        #expect(readings.rows(
            under: .subagent(0),
            of: FeedAgents.all(in: landed, of: .notRunning),
            otherwise: landed,
        ).map(\.content) == [.message(Self.said)])
    }

    /// The same fallback for an Agent that has left the list — a live transcript can be re-read,
    /// and a scope names a delegation rather than holding one.
    @Test
    func `a scope naming an agent the rail no longer lists drops back to the session`() {
        let session = FeedProjection.rows(from: FeedFixture.handedOver(subagent: Self.read))

        #expect(readings.rows(
            under: .subagent(99),
            of: FeedAgents.all(in: session, of: .running),
            otherwise: session,
        ) == session)
    }

    @Test
    func `a scope on a read agent draws that agent's rows over the session's`() {
        let session = FeedProjection.rows(from: FeedFixture.handedOver(subagent: Self.read))
        let scoped = readings.rows(
            under: .subagent(1),
            of: FeedAgents.all(in: session, of: .running),
            otherwise: session,
        )

        #expect(scoped.map(\.content) == [.message(Self.said)])
    }

    /// The rail lists the SESSION's Subagents whatever the feed beside it is scoped to. Read off a
    /// scoped feed it would empty itself the moment somebody used it.
    @Test
    func `the rail's agents are the session's, not the scoped reading's`() {
        let session = FeedProjection.rows(from: FeedFixture.handedOver(subagent: Self.read))
        let scoped = FeedProjection.rows(from: [.message(markdown: Self.said)])

        #expect(zoning(feed: scoped, agents: FeedAgents.all(in: session, of: .running)).agents
            .count == 2)
    }

    /// The strip is narrower than the seam's own floor, which is the whole reason collapsing is not
    /// a drag to the minimum.
    @Test
    func `a collapsed rail takes its strip's width rather than the seam's`() {
        let collapsed = zoning(
            feed: working,
            agents: FeedAgents.all(in: working, of: .running),
            collapsed: true,
        )

        #expect(collapsed.railWidth == ArgoAgentsRail.collapsedWidth)
        #expect(collapsed.railWidth < ArgoLayout.railWidths.lowerBound)
    }

    /// The lane's share is taken from what the rail leaves, so collapsing the rail has to hand the
    /// width over rather than leave a gap nothing draws.
    ///
    /// Measured at a deck narrow enough that the lane's share is still live: at the window's ideal
    /// width the share is over its ceiling either way, so the widest deck would show nothing move.
    @Test
    func `collapsing the rail gives its width back to the reading`() {
        let agents = FeedAgents.all(in: working, of: .running)
        let open = zoning(deck: Self.narrowDeck, feed: working, agents: agents)
        let shut = zoning(deck: Self.narrowDeck, feed: working, agents: agents, collapsed: true)

        #expect(shut.laneWidth > open.laneWidth)
    }

    // MARK: - Fixtures

    /// The one Subagent this suite has a reading of, and the one line that reading holds.
    private static let read = "a-back"
    private static let said = "The fold holds."

    private let readings = FeedAgentReader(
        events: [read: [.message(markdown: said)]],
    )

    private func agents(in events: [TranscriptEvent]) -> [FeedAgent] {
        FeedAgents.all(in: FeedProjection.rows(from: events), of: .running)
    }

    /// One delegation, answered — a chip the rail still lists, with nothing running.
    private func settled() -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call("back", tool: "Task", kind: .delegate, naming: "verify")),
            .toolCallOutcome(TranscriptFixtures.spent(
                "back",
                FeedFixture.delegated,
                subagent: Self.read,
            )),
        ]
    }

    /// A handover the record has not answered, which is a subagent still running beside a Session
    /// that is.
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
                rail: .constant(ArgoAgentsRail.width),
                panel: .constant(nil),
            ),
            isRailCollapsed: collapsed,
        )
    }
}
