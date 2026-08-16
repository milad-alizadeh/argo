import ArgoEngine
@testable import ArgoUI
import Testing

/// When the ask row is a thing you press rather than a thing you read. The whole claim of this
/// suite is that the affordance appears only where the answer can actually reach somebody.
@Suite("Feed ask projection")
struct FeedAskProjectionTests {
    private static let question = Ask.Question(
        text: "Which ticket should I implement?",
        options: Ask.Option.labelled(["#712", "#713"]),
    )

    private static let live = SessionAsk(id: "ask-1", ask: Ask(questions: [question]))

    private func session(
        ask: SessionAsk? = live,
        access: CockpitPresentation.Session.Access = .managed,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: "A Session",
            model: "claude-opus-5",
            workspaceLocation: "/repo",
            access: access,
            status: ask == nil ? .idle : .asking,
            ask: ask,
            events: [.toolCall(FeedFixture.asking(Self.question))],
        )
    }

    @Test
    func `a Session blocked on a question offers it`() throws {
        let live = try #require(FeedAskProjection.live(for: session()))

        #expect(live.sessionID == "session")
        #expect(live.askID == "ask-1")
        #expect(live.ask == Self.live.ask)
    }

    @Test
    func `a Session blocked on nothing offers nothing`() {
        #expect(FeedAskProjection.live(for: session(ask: nil)) == nil)
        #expect(FeedAskProjection.live(for: nil) == nil)
    }

    /// An answer whose gate died with the PTY reaches nobody, so an affordance there is exactly the
    /// one that cannot work (#546). The row above stays a reading.
    @Test
    func `an undriveable Session draws no affordance at all`() {
        #expect(FeedAskProjection.live(for: session(access: .external)) == nil)
        #expect(FeedAskProjection.live(for: session(access: .orphaned)) == nil)
    }

    @Test
    func `the live question is the one the matching row draws`() throws {
        let rows = FeedProjection.rows(
            from: [.toolCall(FeedFixture.asking(Self.question))],
            asking: FeedAskProjection.asking(for: session()),
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(ask.isWaiting)
        #expect(ask.live?.askID == "ask-1")
    }

    /// The match is by value, because neither side carries an id the other knows. A row asking
    /// something else is not the question the gate is holding.
    @Test
    func `a row drawing a different question stays a reading`() throws {
        let other = Ask.Question(text: "Something else?", options: [])
        let rows = FeedProjection.rows(
            from: [.toolCall(FeedFixture.asking(other))],
            asking: FeedAskProjection.asking(for: session()),
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(!ask.isWaiting)
        #expect(ask.live == nil)
    }

    /// The record has settled it, so nothing is waiting on anybody however the gate reads.
    @Test
    func `a question the record already answered is never pressable`() throws {
        let rows = FeedProjection.rows(
            from: [
                .toolCall(FeedFixture.asking(Self.question)),
                .toolCallOutcome(FeedFixture.answered("ask", .output(
                    OutputEvidence(tier: .direct, text: "#712"),
                ))),
            ],
            asking: FeedAskProjection.asking(for: session()),
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(!ask.isWaiting)
    }

    /// Two identical questions both match by value — there is no id either side shares — so the
    /// newest is the one still waiting, and the older stays the reading it became.
    @Test
    func `where one question was asked twice, the newest is the one you press`() {
        let rows = FeedProjection.rows(
            from: [
                .toolCall(FeedFixture.asking(Self.question)),
                .toolCall(ToolCall(
                    id: "ask-again", name: ToolCall.askUserQuestion, kind: .other,
                    target: nil, atMs: nil, ask: Ask(questions: [Self.question]),
                )),
            ],
            asking: FeedAskProjection.asking(for: session()),
        )

        #expect(FeedFixture.asks(in: rows).map(\.isWaiting) == [false, true])
    }

    /// The attention ink means *this is waiting on YOU*, so it goes with the affordance: a question
    /// on an undriveable Session is a reading, ground and all.
    @Test
    func `a question nobody here can answer is drawn as the reading it is`() throws {
        let rows = FeedProjection.rows(
            from: [.toolCall(FeedFixture.asking(Self.question))],
            asking: FeedAskProjection.asking(for: session(access: .orphaned)),
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(ask.isPending)
        #expect(!ask.isWaiting)
        #expect(ask.ink == .message)
    }

    /// The distinction the two facts exist for. A DRIVEABLE Session whose gate has not raised this
    /// question — Argo restarted under a CLI still holding it — is still waiting: no cards, since
    /// there is nothing to answer through, but the attention ink stays. Quieting it there would
    /// render a question nobody answered as one somebody did.
    @Test
    func `a driveable Session whose gate holds no question is still waiting`() throws {
        let rows = FeedProjection.rows(
            from: [.toolCall(FeedFixture.asking(Self.question))],
            asking: FeedAskProjection.asking(for: session(ask: nil)),
        )
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(!ask.isWaiting)
        #expect(ask.ink == .attention)
    }

    /// Nothing was handed in, so nothing is pressable — the state every specimen and preview is in.
    /// Driveable, because a render is a reading of a live cockpit and not of a dead Session.
    @Test
    func `a feed with no live question offers none, and is still waiting`() throws {
        let rows = FeedProjection.rows(from: [.toolCall(FeedFixture.asking(Self.question))])
        let ask = try #require(FeedFixture.asks(in: rows).first)

        #expect(!ask.isWaiting)
        #expect(ask.ink == .attention)
    }

    /// The marks a waiting row holds are keyed by this, because the rows are hosted in a recycled
    /// table cell — two different questions must never share one identity.
    @Test
    func `a question is identified by what it asked, not by where it was drawn`() {
        let other = Ask.Question(text: "Something else?", options: [])
        let asked = FeedAsk(ask: Ask(questions: [Self.question]), isAnswered: false, answer: nil)
        let another = FeedAsk(ask: Ask(questions: [other]), isAnswered: false, answer: nil)

        #expect(asked.identity != another.identity)
        // Settling it does not make it a different question, so the marks are not thrown away
        // underneath the answer that is still going.
        #expect(asked.identity == FeedAsk(
            ask: Ask(questions: [Self.question]),
            isAnswered: true,
            answer: "#712",
        ).identity)
    }
}
