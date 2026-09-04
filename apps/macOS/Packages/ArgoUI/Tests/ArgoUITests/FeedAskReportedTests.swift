import ArgoEngine
@testable import ArgoUI
import Testing

/// The question an agent raised over the companion plugin, put to the reader (#1205).
///
/// `CompanionReport.pendingAsk` put `Needs input` on the roster at CONVENTION and reached no
/// surface, so the reader was told to answer and given nothing to answer. This is the row that
/// closes it — and the constraints on the row, which are not `standing`'s: Argo answered the call
/// `Recorded` the moment it arrived, so nothing here is pressable and the row says where an answer
/// can actually go.
///
/// Apart from `FeedAskStandingTests`, which is the same fault on Argo's OWN gate: that question is
/// held open, this one is only reported.
@Suite("Feed reported ask")
struct FeedAskReportedTests {
    private let reported = CompanionAsk(
        id: "call-1",
        question: "Which branch should I cut?",
        options: ["main", "the ticket branch"],
    ).ask

    private func rows(
        _ reported: Ask?,
        driveable: Bool = true,
    )
        -> [FeedAsk] {
        FeedFixture.asks(in: FeedProjection.rows(
            from: [.prompt(text: "/implement 1205", images: [], atMs: nil)],
            asking: FeedAskProjection.Asking(live: nil, isDriveable: driveable),
            reported: reported,
        ))
    }

    @Test
    func `a reported question is put to the reader, words and options intact`() throws {
        let ask = try #require(rows(reported).first)

        #expect(ask.ask == reported)
        #expect(try ask.offers(in: #require(ask.questions.first)).map(\.label)
            == ["main", "the ticket branch"])
    }

    /// The whole of what degrade-down asks of this row: it arrived over the plugin, and a row Argo
    /// does not own must not be indistinguishable from one it does.
    @Test
    func `a reported question is drawn at CONVENTION and says so`() throws {
        let ask = try #require(rows(reported).first)

        #expect(ask.tier == .convention)
        #expect(ask.isReported)
    }

    /// Argo answered the MCP call the moment it landed, so no reply is held and no press could
    /// reach one. `isWaiting` is what the row forks its cards on, so this IS the absence of them.
    @Test
    func `a reported question offers nothing to press`() throws {
        let ask = try #require(rows(reported).first)

        #expect(ask.live == nil)
        #expect(ask.isWaiting == false)
    }

    /// It is still unanswered, and on a Session somebody can still type at it is still waiting on
    /// them — the ink #1190 keeps for a driveable Session whose gate has raised nothing.
    @Test
    func `a reported question keeps the attention ink where the Session can be driven`() throws {
        #expect(try #require(rows(reported).first).ink == .attention)
    }

    /// And loses it where nothing reaches the agent: amber nobody can act on is the affordance
    /// that lies (#546).
    @Test
    func `a reported question goes quiet on a Session nothing can reach`() throws {
        #expect(try #require(rows(reported, driveable: false).first).ink == .message)
    }

    @Test
    func `a Session that reported no question draws no row`() {
        #expect(rows(nil).isEmpty)
    }

    /// The two channels are two questions and both get a row: the gate's is held open and
    /// pressable, the plugin's is a reading. Collapsing them would drop one question on the floor.
    @Test
    func `a reported question stands beside the one Argo's own gate is holding`() {
        let rows = FeedProjection.rows(
            from: [.prompt(text: "/implement 1205", images: [], atMs: nil)],
            asking: FeedAskProjection.asking(for: FeedFixture.askingSession()),
            reported: reported,
        )

        #expect(FeedFixture.asks(in: rows).map(\.tier) == [.direct, .convention])
        #expect(FeedFixture.asks(in: rows).map(\.isWaiting) == [true, false])
    }

    /// The tier survives `offering`, which rebuilds every ask row in the feed and would otherwise
    /// drop a field the initializer does not carry — the trap `FeedAsk.offered` names.
    @Test
    func `stating the offer again does not lose the tier`() {
        let ask = FeedAsk(ask: reported, isAnswered: false, answer: nil).known(via: .convention)

        #expect(ask.offered(FeedAskProjection.Asking(live: nil, isDriveable: true)).tier
            == .convention)
    }

    /// The whole seam, from the fact the roster publishes to the row the deck draws — the join
    /// #1205 found missing, where `CompanionReport.pendingAsk` left `ArgoEngine` for nowhere.
    @Test
    @MainActor
    func `the deck's reading draws the question the Session reported`() throws {
        let reading = SessionsRoomReading(
            presentation: Self.presentation(reporting: reported),
            sessionID: "one",
        )

        #expect(try #require(Self.asks(in: reading).first).isReported)
    }

    /// A question that has been answered leaves the report with no event appended to the stream,
    /// so a stamp that stopped at the events would go on drawing it. The other half of the rule
    /// every by-value fact on `SessionsRoomReadingCache.Stamp` is there for.
    @Test
    @MainActor
    func `a question the agent has moved on from stops being drawn`() {
        let asked = SessionsRoomReading(
            presentation: Self.presentation(reporting: reported),
            sessionID: "one",
        )
        let answered = SessionsRoomReading(
            presentation: Self.presentation(reporting: nil),
            sessionID: "one",
        )

        #expect(Self.asks(in: asked).count == 1)
        #expect(Self.asks(in: answered).isEmpty)
    }

    private static func asks(in reading: SessionsRoomReading) -> [FeedAsk] {
        FeedFixture.asks(in: reading.feed)
    }

    private static func presentation(reporting ask: Ask?) -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: [CockpitPresentation.Session(
                id: "one",
                title: "one",
                access: .managed,
                status: ask == nil ? .idle : .asking,
                autonomy: .init(blocked: .init(companionAsk: ask.map {
                    CompanionAsk(
                        id: "call-1",
                        question: $0.questions.first?.text ?? "",
                        options: $0.questions.first?.options.map(\.label) ?? [],
                    )
                })),
                transcript: .init(events: [.prompt(
                    text: "/implement 1205",
                    images: [],
                    atMs: nil,
                )]),
            )],
            checkout: .unavailable,
            connection: .idle,
        )
    }
}
