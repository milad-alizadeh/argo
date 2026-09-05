import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The deck is torn down and rebuilt on each room switch, and its measured heights no longer are
/// (#858) — and a reading remembered beside them would draw the transcript as it stood when the
/// reader last looked at it. These state the guarantee directly: the reading answers for the
/// presentation it is handed, on every pass. What `SessionsRoomReadingCache` remembers is held to
/// exactly that by a stamp of the inputs — `SessionsRoomReadingCostTests` holds the other half.
@Suite("Sessions room reading")
@MainActor
struct SessionsRoomReadingTests {
    /// The claim a memoised feed would break, and the one the stamp exists to keep: a transcript
    /// that grew while the reader was in another room reads as it is NOW, not as it was when they
    /// last looked at it.
    @Test
    func `a transcript that grew reads as it stands now`() {
        let opening = Self.reading(events: Array(Self.transcript.prefix(3)))
        let grown = Self.reading(events: Self.transcript)

        #expect(opening.feed.count < grown.feed.count)
    }

    /// The other half of the same claim, across the selection rather than across time: the deck
    /// keeps its identity through a room switch, so a reading carried over would draw one Session's
    /// transcript under another's name.
    @Test
    func `the reading follows the selection`() {
        let presentation = CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [
                Self.session(id: "one", events: Self.transcript),
                Self.session(id: "two", events: []),
            ],
            connection: .idle,
        )

        let quiet = SessionsRoomReading(presentation: presentation, sessionID: "two")

        #expect(!SessionsRoomReading(presentation: presentation, sessionID: "one").feed.isEmpty)
        #expect(quiet.feed.isEmpty)
        #expect(quiet.header?.title == "two")
    }

    /// The header's title is the ROSTER's decision, taken over the rows the roster draws (#1251).
    /// Read here rather than off `SessionHeaderProjection.header(from:title:)`, because the wiring
    /// between the two is the half that was wrong: the reading used to ask across every Session it
    /// held, so a row behind the archive foot moved the header and not the row.
    @Test
    func `the header keeps the words a rival behind the foot leaves alone`() {
        let issue = CockpitPresentation.Session.Issue(number: 650, title: "Rough atlas for Argo")
        let presentation = CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [
                RosterSessionFixture.session(id: "live", ticket: .linked(issue)),
                RosterSessionFixture
                    .session(id: "filed", isArchived: true, ticket: .linked(issue)),
            ],
            connection: .idle,
        )

        let reading = SessionsRoomReading(presentation: presentation, sessionID: "live")

        #expect(reading.header?.title == "Rough atlas for Argo")
    }

    /// With nothing selected there is no Session to read, which is the one case that draws nothing
    /// — never a room the deck happens to be out of.
    @Test
    func `nothing selected reads as nothing at all`() {
        let reading = SessionsRoomReading(
            presentation: Self.presentation(events: Self.transcript),
            sessionID: nil,
        )

        #expect(reading.feed.isEmpty)
        #expect(reading.header == nil)
        #expect(reading.showing.plan == nil)
    }

    /// #1391: the header used to resolve its Session's title against itself alone, so a Session
    /// that had given its linked Ticket's words up to a rival row (#1072) kept them on the header
    /// anyway. The row and the header now read the SAME decision.
    @Test
    func `the header reads the title its own row draws, not the ticket a rival row keeps`() throws {
        let issue = CockpitPresentation.Session.Issue(
            number: 1333,
            title: "The room can file a ticket and start it, but never close it",
        )
        let presentation = CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [
                RosterSessionFixture.session(
                    id: "one", title: "/implement 1333", ticket: .linked(issue),
                ),
                RosterSessionFixture.session(
                    id: "two", title: "/implement 1333 again", ticket: .linked(issue),
                ),
            ],
            connection: .idle,
        )

        let row = try #require(SessionRosterProjection.rows(from: presentation.sessions)
            .first { $0.id == "one" })
        let reading = SessionsRoomReading(presentation: presentation, sessionID: "one")

        #expect(reading.header?.title == row.title)
        #expect(reading.header?.title == "/implement 1333")
    }

    /// The gate `CockpitView.body` evaluates on every pass, in every room: only the room that
    /// DRAWS a transcript pays for the projection behind one (#858).
    @Test(arguments: [(CockpitRoom.sessions, true), (.tickets, false), (.code, false)])
    func `only the room that draws a transcript takes a reading`(room: CockpitRoom, reads: Bool) {
        let reading = SessionsRoomReading.taken(
            in: room,
            of: Self.presentation(events: Self.transcript),
            for: "one",
        )

        #expect(!reading.feed.isEmpty == reads)
        #expect((reading.header != nil) == reads)
    }

    /// `starting` ends with no event appended, so the stamp has to carry the status itself:
    /// without it the cache answers a Session that is up with the reading it took while it was
    /// starting, and `starting the agent` stands over an agent at its prompt (#587).
    @Test
    func `a Session that has come up is a fresh reading, not the one the cache holds`() {
        let starting = SessionsRoomReading(
            presentation: Self.presentation(status: .starting),
            sessionID: "one",
        )
        let up = SessionsRoomReading(
            presentation: Self.presentation(status: .idle),
            sessionID: "one",
        )

        // The reading is empty on BOTH sides — a wait is not a row while it runs — so what the
        // cache is proved not to have held is the WAIT: the plinth stands over the first and is
        // gone from the second.
        #expect(starting.feed.isEmpty)
        #expect(starting.wait == .starting)
        #expect(up.feed.isEmpty)
        #expect(up.wait == nil)
    }

    private static let transcript = TranscriptFixtures.previewTranscript

    private static func reading(events: [TranscriptEvent]) -> SessionsRoomReading {
        SessionsRoomReading(presentation: presentation(events: events), sessionID: "one")
    }

    private static func presentation(events: [TranscriptEvent]) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [session(id: "one", events: events)],
            connection: .idle,
        )
    }

    private static func session(
        id: String,
        events: [TranscriptEvent],
        status: SessionStatus = .idle,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: id,
            access: .managed,
            status: status,
            transcript: .init(events: events),
        )
    }

    private static func presentation(status: SessionStatus) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [session(id: "one", events: [], status: status)],
            connection: .idle,
        )
    }
}
