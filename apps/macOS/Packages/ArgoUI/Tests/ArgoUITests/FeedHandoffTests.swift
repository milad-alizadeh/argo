import ArgoEngine
@testable import ArgoUI
import Testing

/// The chain at the foot of a handed-off reading: where the row goes, what it says, and the two
/// ways it is deliberately absent. The one input to the feed that is not the record — Argo's own
/// memory of a handoff.
@Suite("Feed handoff")
struct FeedHandoffTests {
    /// The last row of all, under the record's own last row.
    @Test
    func `a handed-off reading ends with the link to the Session that took the work`() throws {
        let rows = FeedProjection.rows(from: Self.transcript, handedOff: Self.handoff)

        let last = try #require(rows.last)
        #expect(last.content == .mark(.handedOff(Self.handoff)))
        #expect(rows.dropLast().last?.content == .mark(.turnEnded))
    }

    /// Named in the roster's own words rather than in a sentence written here.
    @Test
    func `the link says which Session it leads to`() {
        #expect(FeedMark.handedOff(Self.handoff).words == "handed off to Continue the shell work")
        #expect(FeedMark.handedOff(Self.handoff).handoff == Self.handoff)
    }

    /// Every other mark leads nowhere and must not become pressable.
    @Test
    func `every other mark leads nowhere`() {
        #expect(FeedMark.compacted.handoff == nil)
        #expect(FeedMark.turnEnded.handoff == nil)
        #expect(FeedMark.interrupted.handoff == nil)
    }

    /// The row is not an empty slot at the foot of every reading in the app.
    @Test
    func `a Session that handed nothing over ends where its record does`() {
        let rows = FeedProjection.rows(from: Self.transcript)

        #expect(rows.last?.content == .mark(.turnEnded))
        #expect(!rows.contains { $0.content.isHandoff })
    }

    /// The link is resolved against the roster it would land in, so it cannot point at a row nobody
    /// can show. A Session whose successor has left the roster — a Project switch, or a spawn whose
    /// row stood down without a record — draws no link at all rather than a dead one.
    @Test
    func `a chain the roster cannot follow is not drawn`() throws {
        let fresh = Self.session(id: "fresh", title: "Continue the shell work")
        let full = Self.session(id: "full", title: "The full Session", handedOffTo: "fresh")

        let followable = try #require(Self.presentation([full, fresh]).handoff(of: "full"))
        #expect(followable == FeedHandoff(sessionID: "fresh", title: "Continue the shell work"))
        #expect(Self.presentation([full]).handoff(of: "full") == nil)
    }

    @Test
    func `a Session with no chain resolves to no link`() {
        let full = Self.session(id: "full", title: "The full Session")

        #expect(Self.presentation([full]).handoff(of: "full") == nil)
        #expect(Self.presentation([full]).handoff(of: nil) == nil)
    }

    private static let handoff = FeedHandoff(
        sessionID: "fresh",
        title: "Continue the shell work",
    )

    private static let spend = Usage(
        inputTokens: 12,
        outputTokens: 34,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
    )

    /// A reading with something in it, so the link's PLACE is asserted against the row it has to
    /// sit below rather than against an empty list. The spend is reported and drawn nowhere, which
    /// is the point of it being here (#1248).
    private static let transcript: [TranscriptEvent] = [
        .prompt(text: "Take this on", images: [], atMs: 1000),
        .message(markdown: "On it."),
        .turnEnded(.endTurn),
        .usage(spend),
    ]

    private static func session(
        id: String,
        title: String,
        handedOffTo: String? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            access: .managed,
            status: .idle,
            chain: .init(program: .init(model: "claude-opus-5"), handedOffTo: handedOffTo),
            work: .init(location: "/Users/milad/Developer/argo"),
        )
    }

    private static func presentation(
        _ sessions: [CockpitPresentation.Session],
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: sessions,
            connection: .idle,
        )
    }
}

private extension FeedRow.Content {
    var isHandoff: Bool {
        guard case let .mark(mark) = self else { return false }
        return mark.handoff != nil
    }
}
