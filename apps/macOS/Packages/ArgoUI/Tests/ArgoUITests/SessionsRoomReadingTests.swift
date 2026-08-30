import ArgoEngine
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
            checkout: .unavailable,
            connection: .idle,
        )

        let quiet = SessionsRoomReading(presentation: presentation, sessionID: "two")

        #expect(!SessionsRoomReading(presentation: presentation, sessionID: "one").feed.isEmpty)
        #expect(quiet.feed.isEmpty)
        #expect(quiet.header?.title == "two")
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

    private static let transcript = TranscriptFixtures.previewTranscript

    private static func reading(events: [TranscriptEvent]) -> SessionsRoomReading {
        SessionsRoomReading(presentation: presentation(events: events), sessionID: "one")
    }

    private static func presentation(events: [TranscriptEvent]) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [session(id: "one", events: events)],
            checkout: .unavailable,
            connection: .idle,
        )
    }

    private static func session(
        id: String,
        events: [TranscriptEvent],
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: id,
            access: .managed,
            status: .idle,
            transcript: .init(events: events),
        )
    }
}
