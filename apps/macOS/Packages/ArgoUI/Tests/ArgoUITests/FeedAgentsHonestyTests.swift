import ArgoEngine
@testable import ArgoUI
import Testing

/// A Subagent cannot be running when the Session that delegated it is not (#1076).
///
/// The STALE case is what every claim here is built on: a backgrounded delegation whose report
/// never landed, left pending for the life of the record. Read in isolation it draws a green dot
/// and a clock counting up from a handover 43 hours old; read beside its Session's own status it is
/// a record nothing will ever close.
@Suite("Feed agents honesty")
@MainActor
struct FeedAgentsHonestyTests {
    /// The bug, in one claim.
    @Test
    func `a delegation left pending by a session that is not running is not running`() {
        let chips = FeedAgents.all(in: Self.rows, of: .notRunning)

        #expect(chips.map(\.isRunning) == [false])
        #expect(FeedAgents.running(of: chips) == 0)
    }

    /// And the other half of it: the fix is not a rail that went quiet for good. A delegation still
    /// open in a Session that IS running is a Subagent still working, and reads as one.
    @Test
    func `a delegation still pending in a running session is still running`() {
        let chips = FeedAgents.all(in: Self.rows, of: .running)

        #expect(chips.map(\.isRunning) == [true])
        #expect(FeedAgents.running(of: chips) == 1)
    }

    /// degrade-down: a Session Argo cannot observe resolves to the quieter state, so it never
    /// produces a green dot. Nor do the two the ticket was written from, nor an ORPHANED Session —
    /// which is an `Access` and not a status, so what makes it quiet is the status its record left
    /// behind (`CONTEXT.md` L2, ADR-0026).
    @Test
    func `a session that cannot be driving anything produces no running chip`() {
        for status in [SessionStatus.unknown, .stopped, .ended, .idle] {
            let chips = FeedAgents.all(in: Self.rows, of: DelegatingSession.of(status))

            #expect(chips.map(\.isRunning) == [false], "\(status)")
        }
        #expect(Self.listing(of: .ended, access: .orphaned).map(\.isRunning) == [false])
    }

    /// The other half of the ruling: a Session blocked on a permission prompt is alive, and the
    /// Subagent it launched is genuinely still out — so the chip keeps its running dot rather than
    /// being quieted by a Session that is merely waiting on its reader.
    @Test
    func `a session waiting on the reader keeps its subagent running`() {
        #expect(Self.listing(of: .permission).map(\.isRunning) == [true])
        #expect(Self.listing(of: .asking).map(\.isRunning) == [true])
    }

    /// The clock, which is the same untruth with the animation removed: a chip whose Session is
    /// dead and which reported no total has NOTHING to draw — `AgentMeter` draws the count-up only
    /// while `isRunning`, and the reported total only where the record states one.
    @Test
    func `a stale chip has neither a total nor a clock to draw`() throws {
        let chip = try #require(FeedAgents.all(in: Self.rows, of: .notRunning).first)

        #expect(!chip.isRunning)
        #expect(chip.durationMs == nil)
    }

    /// The first coupling (`DeckZoning`): honest dots alone would take the rail off screen and the
    /// finished chips with it. The rail is on screen because the Session HAS delegations.
    @Test
    func `the rail stays on screen for a session with delegations and none running`() {
        let zoning = Self.zoning(agents: FeedAgents.all(in: Self.rows, of: .notRunning))

        #expect(zoning.showsRail)
    }

    /// And it is still the Session's delegations that put it there: one that handed nothing over
    /// gets no rail, whatever its status.
    @Test
    func `a session that delegated nothing has no rail`() {
        let quiet = FeedProjection.rows(from: [.message(markdown: "Done.")])

        #expect(!Self.zoning(agents: FeedAgents.all(in: quiet, of: .running)).showsRail)
    }

    /// The second coupling (`FeedAgentReader`): with nothing running, a chip click would silently
    /// fall back to the Session's own feed. A scope is honoured while the rail is LISTING.
    @Test
    func `a chip is still scoped onto when nothing is running`() {
        let agents = FeedAgents.all(in: Self.rows, of: .notRunning)
        let scoped = Self.readings.rows(under: .subagent(0), of: agents, otherwise: Self.rows)

        #expect(scoped.map(\.content) == [.message(Self.said)])
    }

    /// A Session with no delegations at all still drops back — the rail is off screen there, so a
    /// scope would strand the reader in a feed with no chip to click.
    @Test
    func `a scope drops back to the session where the rail lists nothing`() {
        let quiet = FeedProjection.rows(from: [.message(markdown: "Done.")])

        #expect(Self.readings.rows(under: .subagent(0), of: [], otherwise: quiet) == quiet)
    }

    /// The whole seam, end to end: the reader the shell hands the deck is stamped with the reading
    /// it is drawn beside, and that stamp carries the Session's own status — so the rail's list is
    /// honest without any surface below it asking a second question.
    @Test
    func `the reader lists a quiet session's delegations as not running`() {
        #expect(Self.listing(of: .idle).map(\.isRunning) == [false])
        #expect(Self.listing(of: .running).map(\.isRunning) == [true])
    }

    // MARK: - Fixtures

    /// The one Subagent this suite has a reading of, and the line that reading holds.
    private static let read = "a-away"
    private static let said = "The fold holds."

    private static let readings = FeedAgentReader(events: [read: [.message(markdown: said)]])

    /// One backgrounded delegation, its receipt filed and no report behind it — the shape of all 73
    /// chips in the Session this ticket was written from.
    private static let launched: [TranscriptEvent] = [
        .toolCall(FeedFixture.call("away", tool: "Agent", kind: .delegate, naming: "review")),
        .toolCallOutcome(TranscriptFixtures.launched("away", subagent: read)),
    ]

    private static let rows = FeedProjection.rows(from: launched)

    /// The rail's list as the shell derives it: through the reader, stamped with a reading of a
    /// Session at this status.
    private static func listing(
        of status: SessionStatus,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> [FeedAgent] {
        SessionsRoomReadingCache.forget()
        let reading = SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [session(status, access: access)],
                checkout: .unavailable,
                connection: .idle,
            ),
            sessionID: "one",
        )
        return readings.stamped(reading.stamp).agents(in: reading.feed)
    }

    private static func session(
        _ status: SessionStatus,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: access,
            status: status,
            transcript: .init(events: launched),
        )
    }

    private static func zoning(agents: [FeedAgent]) -> DeckZoning {
        DeckZoning(deck: 1400, feed: rows, agents: agents, open: nil, seams: .unheld)
    }
}
