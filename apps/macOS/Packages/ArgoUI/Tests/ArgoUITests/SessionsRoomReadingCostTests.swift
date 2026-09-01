import ArgoEngine
@testable import ArgoUI
import Testing

/// What a reading COSTS the second time (ADR-0028 Rule 1 and Rule 7).
///
/// `CockpitView.body` re-runs on any of its own state changes and on every presentation the Hub
/// publishes, and every pass took the whole projection again — clicking a roster row cost a walk of
/// its transcript, and clicking BACK cost the identical walk a second time. Counters and RATIOS,
/// never a duration: a seconds literal encodes the machine it was written on.
///
/// The two recorded folds — a repeat reading against a cold one, and a second scoped reader
/// against the first — are `PerfBudgets.repeatReadingFold` and `PerfBudgets.scopedReadingFold`
/// (#953). Each budget below is the cold figure measured in the SAME run over 3x the warm figure
/// recorded there, which is Rule 7's multiplier applied to a ratio rather than to a number that
/// names this machine.
///
/// The warm side is timed over `passes` repeats and divided: at a few hundred nanoseconds a pass,
/// one `CLOCK_THREAD_CPUTIME_ID` reading measures the clock's granularity, not the work.
@Suite("Sessions room reading cost", .serialized)
@MainActor
struct SessionsRoomReadingCostTests {
    /// The user's complaint: coming back to a Session already read walks nothing.
    @Test
    func `a repeat reading at the same stamp costs near nothing`() {
        let presentation = Self.presentation(events: Self.long)

        let cold = leastCPUSeconds {
            SessionsRoomReadingCache.forget()
            _ = SessionsRoomReading(presentation: presentation, sessionID: "one")
        }
        let again = Self.perPass {
            _ = SessionsRoomReading(presentation: presentation, sessionID: "one")
        }

        #expect(again < cold / Self.repeat480)
    }

    /// Clicking away and back — the case the cache holds its entries for.
    @Test
    func `browsing between Sessions and back reads each of them once`() {
        SessionsRoomReadingCache.forget()
        let presentation = Self.presentation(events: Self.long, ids: ["one", "two"])

        for sessionID in ["one", "two", "one", "two"] {
            _ = SessionsRoomReading(presentation: presentation, sessionID: sessionID)
        }

        #expect(SessionsRoomReadingCache.cost.bodies == 2)
    }

    /// The number the cache holds, as behaviour rather than as a literal: a reader who visits every
    /// one of them and comes back to the first has re-derived nothing.
    @Test
    func `browsing every Session the cache holds re-reads none of them`() {
        SessionsRoomReadingCache.forget()
        let held = ReadingCeilings.readings
        let ids = (0 ..< held).map { "session-\($0)" }
        let presentation = Self.presentation(events: Self.long, ids: ids)

        for sessionID in ids + ids {
            _ = SessionsRoomReading(presentation: presentation, sessionID: sessionID)
        }

        #expect(SessionsRoomReadingCache.cost.bodies == held)
    }

    /// The other half, and the one that matters more: the cache may not mask a stream that grew.
    @Test
    func `an appended event moves the stamp and a fresh reading is taken`() {
        SessionsRoomReadingCache.forget()
        let opening = Self.reading(events: Array(Self.long.prefix(3)))

        let grown = Self.reading(events: Self.long)

        #expect(SessionsRoomReadingCache.cost.bodies == 2)
        #expect(opening.feed != grown.feed)
        #expect(opening.feed.count < grown.feed.count)
    }

    /// A Subagent's own record grows under a Session whose stream has not moved — the fan-out case
    /// the stamp carries per-Agent counts for.
    @Test
    func `a subagent's record growing is a fresh reading too`() {
        SessionsRoomReadingCache.forget()
        let read = FeedFixture.handedOver(subagent: Self.subagent)

        _ = Self.scoped(events: read, subagent: Array(Self.long.prefix(3)))
        _ = Self.scoped(events: read, subagent: Self.long)

        #expect(SessionsRoomReadingCache.cost.bodies == 2)
    }

    /// The second derivation #875 left behind: the deck's zones and the toolbar's evidence toggle
    /// ask the same question of the same rows, a whole view tree apart. One walk answers both.
    @Test
    func `the scoped rows are derived once a pass, not once a reader`() {
        SessionsRoomReadingCache.forget()
        let reading = Self.scoped(events: Self.handOff, subagent: Self.long)
        let scope = FeedScope.subagent(1)

        // The deck's `DeckContentRow`, then `CockpitView.evidenceControl` above it.
        let deck = reading.readings.reading(of: reading.feed, under: scope)
        let toolbar = reading.readings.reading(of: reading.feed, under: scope)

        #expect(deck == toolbar)
        #expect(!deck.isEmpty)
        #expect(SessionsRoomReadingCache.cost.scopes == 1)
        #expect(SessionsRoomReadingCache.cost.agents == 1)
    }

    /// And what that saves, since a counter says only that it happened once.
    @Test
    func `the second reader of the scoped rows walks nothing`() {
        let reading = Self.scoped(events: Self.handOff, subagent: Self.long)
        let scope = FeedScope.subagent(1)

        let first = leastCPUSeconds {
            SessionsRoomReadingCache.forget()
            _ = Self.scoped(events: Self.handOff, subagent: Self.long)
                .readings.reading(of: reading.feed, under: scope)
        }
        let second = Self.perPass { _ = reading.readings.reading(of: reading.feed, under: scope) }

        #expect(second < first / Self.scoped4000)
    }

    /// The two recorded folds with Rule 7's 3x spent on them: a warm pass may cost three times
    /// what it was recorded at, which is a third of the gap. Never rounded UP to fit a red run.
    private static let repeat480 = PerfBudgets.repeatReadingFold
    private static let scoped4000 = PerfBudgets.scopedReadingFold
    /// Enough repeats that a warm pass is timed rather than the clock's own resolution.
    private static let passes = 100

    /// What one warm pass costs, over `passes` of them — the first is a cache write and the rest
    /// are the reads under test, which is what a body pass after the first one is.
    private static func perPass(_ work: () -> Void) -> Double {
        leastCPUSeconds(trials: 20) { for _ in 0 ..< passes {
            work()
        } } / Double(passes)
    }

    private static let long = TranscriptFixtures.longTranscript
    private static let subagent = "a-back"
    private static let handOff = FeedFixture.handedOver(subagent: subagent)

    private static func reading(events: [TranscriptEvent]) -> SessionsRoomReading {
        SessionsRoomReading(presentation: presentation(events: events), sessionID: "one")
    }

    private static func scoped(
        events: [TranscriptEvent],
        subagent read: [TranscriptEvent],
    )
        -> SessionsRoomReading {
        let session = CockpitPresentation.Session(
            id: "one",
            title: "one",
            access: .managed,
            status: .running,
            transcript: .init(events: events, subagentEvents: [subagent: read]),
        )
        return SessionsRoomReading(
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

    private static func presentation(
        events: [TranscriptEvent],
        ids: [String] = ["one"],
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: ids.map {
                CockpitPresentation.Session(
                    id: $0,
                    title: $0,
                    access: .managed,
                    status: .idle,
                    transcript: .init(events: events),
                )
            },
            checkout: .unavailable,
            connection: .idle,
        )
    }
}
