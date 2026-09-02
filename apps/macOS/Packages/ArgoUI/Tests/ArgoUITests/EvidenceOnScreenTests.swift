import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The rows the toolbar's evidence toggle is resolved against, taken from the reading the pass
/// ALREADY took (#957). The constraint #875 established is the one under test: the toggle opens
/// what is ON SCREEN, so a scoped feed is what it reads.
@Suite("Evidence on screen")
@MainActor
struct EvidenceOnScreenTests {
    @Test
    func `a scoped feed opens the newest evidence in the subagent's rows`() throws {
        let reading = Self.reading
        let agent = try #require(FeedAgents.all(in: reading.feed, of: .running)
            .first { Self.readings.hasReading(of: $0) })

        let scoped = Self.readings.reading(of: reading.feed, under: .subagent(agent.id))
        let opened = try #require(Self.opened(by: EvidenceToggling(feed: scoped, open: nil)))

        #expect(opened.steps.first?.address == .filed(Self.subagentRead))
    }

    /// The other half of the same claim: under `FeedScope.session` the toggle reads the root
    /// Agent's own rows, so one reading answers both scopes with different evidence.
    @Test
    func `a feed scoped to the session opens the newest evidence in its own rows`() throws {
        let reading = Self.reading

        let rows = Self.readings.reading(of: reading.feed, under: .session)
        let opened = try #require(Self.opened(by: EvidenceToggling(feed: rows, open: nil)))

        #expect(opened.steps.first?.address == .filed(Self.sessionRead))
    }

    // MARK: - Fixtures

    private static let sessionRead = "session.swift"
    private static let subagentRead = "subagent.swift"
    /// The CLI's id for the one Subagent this suite holds a reading of.
    private static let subagent = "a-back"

    /// The Subagent reading the shell is handed beside the presentation, which is where it lives
    /// since #858 — the projection carries no child's events.
    private static let readings = FeedAgentReader(events: [subagent: read(subagentRead)])

    private static func opened(by toggling: EvidenceToggling) -> FeedEvidence? {
        toggling.feed.first { $0.id == toggling.next }?.content.opened
    }

    private static var reading: SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [session],
                checkout: .unavailable,
                connection: .idle,
            ),
            sessionID: "one",
        )
    }

    /// One delegation still running and one landed, so the rail is listing and a scope is honoured
    /// — plus a read of its own, which is the evidence the unscoped feed opens on.
    private static var session: CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: .managed,
            status: .idle,
            transcript: .init(
                events: FeedFixture.handedOver(subagent: subagent) + read(sessionRead),
            ),
        )
    }

    private static func read(_ path: String) -> [TranscriptEvent] {
        [
            .toolCall(FeedFixture.call(path, tool: "Read", kind: .read, naming: path)),
            .toolCallOutcome(TranscriptFixtures.printed(path, "what \(path) says")),
        ]
    }
}
