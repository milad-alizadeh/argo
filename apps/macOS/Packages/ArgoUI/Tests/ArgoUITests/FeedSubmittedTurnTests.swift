import ArgoEngine
@testable import ArgoUI
import Testing

/// The words appear the moment they are sent (#1278).
///
/// A prompt used to reach the feed only when the record carried it, about a second later, and that
/// second looks exactly like a Turn that was really lost (#682, #1266, #1179). So the feed draws
/// Argo's own submit — DIRECT, and needing no record to say the words exist — and lets the record's
/// own row take its place when it lands.
///
/// What the suite has to pin is the pair of claims that makes that honest: one row and never two,
/// and a row that says Argo typed the words rather than that the CLI answered them.
@Suite("Feed submitted turn")
@MainActor
struct FeedSubmittedTurnTests {
    private static let typed = "Fix the caption, not the sort."

    // MARK: - The row appears

    /// The whole of the report: a Turn is sent and the feed is not empty.
    @Test
    func `a Turn Argo typed is drawn before any record carries it`() {
        let rows = FeedProjection.rows(from: [], submitted: Self.typed)

        #expect(rows.map(\.content) == [.submitted(text: Self.typed)])
    }

    /// Verbatim, like every other thing somebody said in the feed: the reader is looking for their
    /// own sentence, and a summary of it would not settle the question they are asking.
    @Test
    func `the drawn Turn carries the words verbatim`() {
        let rows = FeedProjection.rows(from: [], submitted: Self.typed)

        #expect(rows.first?.kind.words == Self.typed)
    }

    /// Where it settles: at the foot of the work, in the place the record's prompt row will take.
    /// The row above it is the last thing the record said, so nothing between the two moves when
    /// the swap happens.
    @Test
    func `the drawn Turn stands under the work and above the working row`() throws {
        let rows = FeedProjection.rows(
            from: [
                .prompt(text: "First prompt", images: [], atMs: 1000),
                .message(markdown: "Done."),
                .turnEnded(.endTurn),
            ],
            working: true,
            submitted: Self.typed,
        )

        let kinds = rows.map(\.content)
        let drawn = try #require(kinds.firstIndex(of: .submitted(text: Self.typed)))
        let ended = try #require(kinds.firstIndex(of: .mark(.turnEnded)))
        let working = try #require(kinds.firstIndex(of: .mark(.working)))
        #expect(ended < drawn)
        #expect(working > drawn)
    }

    // MARK: - One Turn, never two

    /// Nothing here matches the drawn row against the stream, and nothing needs to: the engine ends
    /// the submission the moment the record grows, so a reading that still carries words is one no
    /// record holds. The pair is asserted through the READING rather than the projection, because
    /// that is the seam where the two could ever disagree.
    @Test
    func `the record landing leaves one Turn in the feed and not two`() {
        let before = Self.reading(events: [], submittedTurn: Self.typed)
        let after = Self.reading(
            events: [.prompt(text: Self.typed, images: [], atMs: 1000)],
            submittedTurn: nil,
        )

        #expect(before.feed.map(\.content) == [.submitted(text: Self.typed)])
        #expect(after.feed.map(\.content) == [.prompt(text: Self.typed, shots: [])])
    }

    /// A Session with nothing typed at it draws no such row — degrade-down, and the shape every
    /// existing reading in the suite still has.
    @Test
    func `a Session with no submitted Turn draws no drawn row`() {
        let rows = FeedProjection.rows(from: [.message(markdown: "Done.")])

        #expect(!rows.contains { $0.content.isSubmitted })
    }

    /// A queued follow-up is held by Argo and never typed at the PTY (#541, #1238), so no
    /// submission is ever filed for one and the feed draws nothing until it really goes down. The
    /// projection cannot invent a row it is handed no words for, which is what this pins.
    @Test
    func `a queued follow-up draws no row of its own`() {
        let rows = FeedProjection.rows(from: [
            .queued,
            .prompt(text: "Held until the Turn ends", images: [], atMs: 1000),
        ])

        #expect(!rows.contains { $0.content.isSubmitted })
    }

    // MARK: - Honest about its tier

    /// It is the reader asking, so the reading takes it as one: the Turn extents, the Copy turn and
    /// the minimap's prompt band all read `isPrompt`, and a drawn Turn that answered `false` would
    /// leave the newest Turn out of every one of them.
    @Test
    func `the drawn Turn reads as a prompt to everything that measures the reading`() {
        let kind = FeedRow.Content.submitted(text: Self.typed).kind

        #expect(kind.isPrompt)
        #expect(kind.isProse)
    }

    /// And it is drawn as its own shape, which is what keeps it from inheriting the treatment a
    /// prompt the transcript confirmed gets: the cell the table recycles for one is not the cell it
    /// recycles for the other.
    @Test
    func `the drawn Turn is not recycled into a confirmed prompt's cell`() {
        #expect(FeedRow.Content.submitted(text: Self.typed).shape == .submitted)
        #expect(FeedRow.Content.prompt(text: Self.typed, shots: []).shape == .prompt)
    }

    /// The reading in the shape the shell hands it, so the words travel the whole seam the shipping
    /// surface uses rather than only the projection's own argument.
    private static func reading(
        events: [TranscriptEvent],
        submittedTurn: String?,
    )
        -> SessionsRoomReading {
        SessionsRoomReading(
            presentation: CockpitPresentation(
                projects: [],
                activeProjectID: nil,
                sessions: [CockpitPresentation.Session(
                    id: "session-1",
                    title: "New session",
                    access: .managed,
                    status: .idle,
                    chain: .init(program: .init(cli: .claude)),
                    transcript: .init(events: events, submittedTurn: submittedTurn),
                )],
                connection: .idle,
            ),
            sessionID: "session-1",
        )
    }
}

private extension FeedRow.Content {
    /// Whether this row is a Turn Argo typed that no record has answered. A helper rather than a
    /// `case` pattern spelled twice: the assertion the suite makes most is the absence of one.
    var isSubmitted: Bool {
        if case .submitted = self {
            true
        } else {
            false
        }
    }
}
