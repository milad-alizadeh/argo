import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// A question the agent asked over the companion channel (#1203). The roster reads `.asking` off
/// the report at CONVENTION, and until this landed the feed under that badge held nothing that
/// asked anything — the same fault #1190 fixed on the gate's channel.
@Suite("Feed reported ask")
struct FeedReportedAskTests {
    private static let reported = CompanionAsk(
        id: "call-1",
        question: "Which branch should I cut from?",
        options: ["main", "the release branch"],
    )

    private static let held = SessionAsk(
        id: "ask-1",
        ask: Ask(questions: [Ask.Question(
            text: "Which ticket should I implement?",
            options: Ask.Option.labelled(["#1203"]),
        )]),
    )

    private func session(
        ask: SessionAsk? = nil,
        reportedAsk: CompanionAsk? = reported,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "A Session",
            access: access,
            status: .asking,
            work: .init(location: "/repo"),
            autonomy: .init(asks: .init(ask: ask, reportedAsk: reportedAsk)),
        )
    }

    /// The fault itself: a reading the record put no question in, under a badge that says there is
    /// one. The words now reach the reader.
    @Test
    func `a reported question reaches a feed the record put none in`() throws {
        let rows = FeedProjection.rows(
            from: [.prompt(text: "/implement 1203", images: [], atMs: nil)],
            asking: FeedAskProjection.asking(for: session()),
            reported: session().reportedAsk?.ask,
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(ask.ask == Self.reported.ask)
        #expect(ask.isPending)
    }

    /// Never pressable, whatever the Session is: `ask_user` was answered `Recorded` before this row
    /// existed, so there is no held connection an answer could go back down. The ink still says it
    /// is waiting — the reader answers in the composer.
    @Test
    func `a reported question waits on the reader and is answered only in the composer`() throws {
        let rows = FeedProjection.rows(
            from: [],
            asking: FeedAskProjection.asking(for: session()),
            reported: session().reportedAsk?.ask,
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(ask.live == nil)
        #expect(!ask.isWaiting)
        #expect(ask.ink == .attention)
    }

    /// The `isDriveable` half of #546 reaches this row exactly as it reaches the gate's: a question
    /// on a Session nothing can reach is not waiting on anybody, so it takes the reading's ink.
    @Test
    func `a reported question nobody here can answer is drawn as the reading it is`() throws {
        let orphaned = session(access: .orphaned)
        let rows = FeedProjection.rows(
            from: [],
            asking: FeedAskProjection.asking(for: orphaned),
            reported: orphaned.reportedAsk?.ask,
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(ask.isPending)
        #expect(ask.ink == .message)
    }

    @Test
    func `a Session whose agent reported nothing draws no row`() {
        let quiet = session(reportedAsk: nil)
        let rows = FeedProjection.rows(
            from: [.prompt(text: "/implement 1203", images: [], atMs: nil)],
            asking: FeedAskProjection.asking(for: quiet),
            reported: quiet.reportedAsk?.ask,
        )

        #expect(FeedFixture.asks(in: rows).isEmpty)
    }

    /// Two channels, two questions, and neither stands for the other. The gate's goes first,
    /// because it is the one that can be answered where it stands.
    @Test
    func `a gate question and a reported one are both put, the answerable one first`() {
        let asking = session(ask: Self.held)
        let rows = FeedProjection.rows(
            from: [],
            asking: FeedAskProjection.asking(for: asking),
            reported: asking.reportedAsk?.ask,
        )
        let asks = FeedFixture.asks(in: rows)

        #expect(asks.map(\.ask) == [Self.held.ask, Self.reported.ask])
        #expect(asks.map { $0.live != nil } == [true, false])
    }

    /// The two channels share no id, so the words are the only thing that can tell one question
    /// from two. Where they agree, the reader gets ONE card — the answerable one — since two would
    /// also hand the recycled table two rows under a single `FeedAsk.identity`.
    @Test
    func `one question raised down both channels is put to the reader once`() {
        let bothWays = session(ask: SessionAsk(id: "ask-1", ask: Self.reported.ask))
        let rows = FeedProjection.rows(
            from: [],
            asking: FeedAskProjection.asking(for: bothWays),
            reported: bothWays.reportedAsk?.ask,
        )
        let asks = FeedFixture.asks(in: rows)

        #expect(asks.count == 1)
        #expect(asks[0].live != nil)
    }

    /// And where the record's own row is the one drawing it, on the same ground: `offering` hands
    /// the gate's handle to that row, and a copy at the foot would ask again under it.
    @Test
    func `a reported question the reading already draws is not put a second time`() {
        let asked = FeedFixture.asking(Ask.Question(
            text: "Which branch should I cut from?",
            options: Ask.Option.labelled(["main", "the release branch"]),
        ))
        let rows = FeedProjection.rows(
            from: [.toolCall(asked)],
            asking: FeedAskProjection.asking(for: session()),
            reported: session().reportedAsk?.ask,
        )

        #expect(FeedFixture.asks(in: rows).count == 1)
    }

    /// An ANSWERED row asking the same thing is history, and history does not stand for a question
    /// being asked now — so the reported one is still put.
    @Test
    func `a settled row asking the same thing does not stand for the live question`() {
        let asked = FeedFixture.asking(Ask.Question(
            text: "Which branch should I cut from?",
            options: Ask.Option.labelled(["main", "the release branch"]),
        ))
        let rows = FeedProjection.rows(
            from: [.toolCall(asked), .toolCallOutcome(TranscriptFixtures.printed("ask", "main"))],
            asking: FeedAskProjection.asking(for: session()),
            reported: session().reportedAsk?.ask,
        )

        #expect(FeedFixture.asks(in: rows).map(\.isPending) == [false, true])
    }

    /// The record does carry the call — `mcp__argo__ask_user` — and it draws as an ordinary call
    /// line, because `FeedAskReading` is gated on the tool NAME. That is deliberate: widening the
    /// gate would read any tool's arguments as a question the moment they happened to fit.
    @Test
    func `the MCP call the record carries is not itself read as a question`() {
        let call = ToolCall(
            id: "call-1",
            name: "mcp__argo__ask_user",
            kind: .other,
            target: nil,
            atMs: nil,
            ask: nil,
        )
        let rows = FeedProjection.rows(from: [.toolCall(call)])

        #expect(FeedFixture.asks(in: rows).isEmpty)
    }
}
