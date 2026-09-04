import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Testing

/// The plinth and the row it drops into the reading (`cockpit-feed-waiting.md`, #1325).
///
/// The claims that matter most are the ones about what is NOT drawn: a plinth over a Session Argo
/// only watched change posture would claim an act nobody performed, and a wait written into the
/// reading while it runs is a row that has to be edited when it ends.
@Suite("Feed wait")
@MainActor
struct FeedWaitTests {
    private static func session(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        settledWaits: [SessionWaitSettled] = [],
        events: [TranscriptEvent] = [],
        hasUnansweredTurn: Bool = false,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session-1",
            title: "New session",
            access: access,
            status: status,
            chain: .init(
                program: .init(cli: .claude),
                span: .init(settledWaits: settledWaits),
            ),
            transcript: .init(events: events, hasUnansweredTurn: hasUnansweredTurn),
        )
    }

    /// One Session, in the shape the shell hands the reading.
    private static func reading(
        access: CockpitPresentation.Session.Access = .managed,
        status: SessionStatus = .idle,
        settledWaits: [SessionWaitSettled] = [],
        events: [TranscriptEvent] = [],
        hasUnansweredTurn: Bool = false,
    )
        -> SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [session(
                    access: access,
                    status: status,
                    settledWaits: settledWaits,
                    events: events,
                    hasUnansweredTurn: hasUnansweredTurn,
                )],
                connection: .idle,
            ),
            sessionID: "session-1",
        )
    }

    private static let started = SessionWaitSettled(wait: .starting, tookMs: 3200)
    private static let neverStarted = SessionWaitSettled(
        wait: .starting,
        tookMs: 800,
        failure: "the process exited with code 1",
    )

    // MARK: - The plinth stands, and the reading is untouched

    /// The whole split the design makes: while the wait runs the plinth carries it and the reading
    /// gains nothing at all.
    @Test
    func `a wait in flight raises the plinth and writes no row`() {
        let reading = Self.reading(status: .starting)

        #expect(reading.wait == .starting)
        #expect(reading.feed.isEmpty)
    }

    /// **Nothing DERIVED may take this surface.** A Session observed from outside can be `running`
    /// for reasons Argo did not cause, and the plinth is read off `starting` alone — which the
    /// engine only ever reports for a process Argo owns the PTY of.
    @Test
    func `no status but starting raises a plinth`() {
        for status in SessionStatus.allCases where status != .starting {
            #expect(Self.reading(status: status).wait == nil, "\(status)")
        }
    }

    /// The same claim from the other end, and the one the acceptance criterion names: an EXTERNAL
    /// Session — one no Argo ever started — cannot reach the surface however it is posed.
    @Test
    func `an external Session never raises a plinth`() {
        #expect(Self.reading(access: .external, status: .running).wait == nil)
    }

    /// `starting` is never read off the rows, because it writes none: a Session Argo has not heard
    /// draws the wordless thread's answer only if something puts one there, and nothing does.
    @Test
    func `the rows never say starting`() {
        let thinking = FeedProjection.rows(from: [.message(markdown: "Done.")], working: true)

        #expect(FeedWait.showing(in: thinking) == .thinking)
        #expect(FeedWait.showing(in: []) == nil)
    }

    // MARK: - The wait ends, and one row lands

    /// Exactly one row, and nothing already in the reading edited: the reading is written once.
    @Test
    func `a wait that ended lands one settled row and edits nothing`() {
        let said: [TranscriptEvent] = [.message(markdown: "Done."), .turnEnded(.endTurn)]
        let before = FeedProjection.rows(from: said).map(\.content)
        let after = FeedProjection.rows(from: said, settledWaits: [Self.started]).map(\.content)

        #expect(after.count == before.count + 1)
        #expect(after.count(where: \.isSettledWait) == 1)
        // The start happened before the record did, so it opens the reading — and everything the
        // record said is below it, in the order it was already in.
        #expect(after.first == .settledWait(Self.started))
        #expect(Array(after.dropFirst()) == before)
    }

    /// The plinth is gone the moment the wait is: a reading holding both would say one thing twice.
    @Test
    func `a settled wait leaves no plinth behind it`() {
        let reading = Self.reading(status: .idle, settledWaits: [Self.started])

        #expect(reading.wait == nil)
        #expect(reading.feed.map(\.content) == [.settledWait(Self.started)])
    }

    /// A failure is no exception to the drop — the plinth clears and the row lands, in failure ink.
    @Test
    func `a wait that failed lands one row and no plinth`() {
        let reading = Self.reading(status: .ended, settledWaits: [Self.neverStarted])

        #expect(reading.wait == nil)
        #expect(reading.feed.map(\.content) == [.settledWait(Self.neverStarted)])
    }

    // MARK: - What each of the three says

    /// Three tenses of one act, and a reader who saw the first has to find the second.
    @Test
    func `the words say the same wait in three tenses`() {
        #expect(FeedWaitWords.starting.running == "Starting the agent")
        #expect(FeedWaitWords.starting.settled == "Started the agent")
        #expect(FeedWaitWords.starting.failed == "The agent did not start")
    }

    /// Taking the word off the screen must not take it off the screen reader: the sentence the
    /// caption in the rule used to carry survives onto the plinth.
    @Test
    func `the plinth keeps the sentence the caption had`() {
        #expect(FeedWaitWords.starting.spokenRunning == "The agent is starting")
    }

    /// The act, never the state: `startSession`'s play triangle is what Argo DID.
    @Test
    func `the wait takes the mark of the act`() {
        #expect(FeedWaitWords.starting.symbol == ArgoSymbol.startSession)
    }

    /// A lit call takes the ion on its own line instead of a plinth — the one wait read off the
    /// rows that has not reached this surface, because it never stands beside `.thinking`
    /// (`FeedWorking.startingWords` comment, `cockpit-feed-waiting.md`).
    @Test
    func `a lit call raises no plinth`() {
        #expect(FeedWaitWords(.call(3)) == nil)
        #expect(FeedWaitWords(.starting) == .starting)
        #expect(FeedWaitWords(.thinking) == .thinking)
    }

    // MARK: - The row's own shape

    /// A wait that ended is a thing that HAPPENED, so it takes a call's shape and a call's tighter
    /// step rather than standing a prose gap away from the work it belongs against.
    @Test
    func `a settled wait takes a call's shape`() {
        #expect(FeedRow.Content.settledWait(Self.started).kind.isCall)
        #expect(FeedRow.Content.settledWait(Self.neverStarted).kind.isCall)
        #expect(FeedRow.Content.settledWait(Self.started).shape == .settledWait)
    }

    /// The lane must show a failed wait in the ink the ROW draws it in, or a run of red in the
    /// reading shows as quiet grey on the map — the one thing a reader scans an overview for.
    @Test
    func `the lane draws a failed wait in the row's own ink`() {
        #expect(Self.started.laneInk == .boundary)
        #expect(Self.neverStarted.laneInk == .failure)
    }

    /// A wait that ended is no Turn boundary: it is a thing that happened inside the reading.
    @Test
    func `a settled wait ends no Turn`() {
        #expect(!FeedRow.Content.settledWait(Self.started).kind.endsTurn)
        #expect(!FeedRow.Content.settledWait(Self.neverStarted).kind.endsTurn)
    }

    /// Floored, and never negative: both moments are Argo's own clock.
    @Test
    func `what a wait took is whole seconds, floored`() {
        #expect(SessionWaitSettled(wait: .starting, tookMs: 3200).tookSeconds == 3)
        #expect(SessionWaitSettled(wait: .starting, tookMs: 900).tookSeconds == 0)
        #expect(SessionWaitSettled(wait: .starting, tookMs: -1).tookSeconds == 0)
    }

    // MARK: - The bottom edge

    /// The reading must not end underneath the plinth, exactly as it must not end underneath the
    /// pill or the vessel — the three costs ADD, because they stack.
    @Test
    func `the plinth buys the reading room at its foot`() {
        let bare = FeedBottomEdge(hasVessel: true)
        let standing = FeedBottomEdge(hasVessel: true, hasWaitPlinth: true)

        // Within a hair rather than exactly: the clearance is a sum of design steps, and the
        // subtraction that isolates this term carries the rounding of every one of them.
        #expect(
            abs(standing.clearance - bare.clearance - FeedWaitPlinth.Measures.footprint) < 0.001,
        )
        #expect(standing.tailLift > bare.tailLift)
    }
}

private extension FeedRow.Content {
    /// One settled row is what the acceptance criterion counts, so the count needs a predicate.
    var isSettledWait: Bool {
        guard case .settledWait = self else { return false }
        return true
    }
}
