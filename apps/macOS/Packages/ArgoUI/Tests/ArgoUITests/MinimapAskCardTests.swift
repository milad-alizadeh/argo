import ArgoEngine
@testable import ArgoUI
import Testing

/// The one row D25 gives a shape of its own — a question — and the two ways it goes quiet again:
/// nobody here can answer it, or somebody already has.
///
/// The card is the only place the lane draws a frame and a rule rather than a line. Every other
/// row's shape is `MinimapRowTests`.
@MainActor
@Suite("Minimap ask card")
struct MinimapAskCardTests {
    @Test
    func `a question is the card the feed draws it in`() {
        let asked = Ask(questions: [Ask.Question(
            text: "Which reading?",
            options: Ask.Option.labelled(["One", "Two"]),
        )])
        let ask = FeedAsk(ask: asked, isAnswered: false, answer: nil)
        // The offers carry the numbers the ROW sets them behind, because the lane places them on
        // the same marker grid the row does.
        #expect(MinimapRowFixture.shape(.ask(ask)) == .card(MinimapAskCard(
            questions: [MinimapAskCard.Question(
                text: "Which reading?",
                under: .offered([
                    MinimapAskCard.Offer(marker: "1.", label: "One"),
                    MinimapAskCard.Offer(marker: "2.", label: "Two"),
                ]),
            )],
            caption: nil,
            ink: .attention,
            isRuled: true,
        )))
        let rects = MinimapRowFixture.shape(.ask(ask)).rects(across: 400, height: 90)
        // The card's own border, stroked across the whole measure, with the words filled inside it.
        #expect(rects.first == MinimapRowRect(
            y: 0, height: 90, from: 0, to: 400, ink: .attention, shape: .frame,
        ))
        #expect(rects.dropFirst().allSatisfy { $0.drawn == .bar && $0.from > 0 })
        // Three lines, each its marker and its words: the question and the two options under it.
        #expect(rects.count == 7)
    }

    /// The attention ink means *this is waiting on YOU*. On a Session Argo cannot drive it is not,
    /// because nothing done here reaches the agent (#546) — so the lane goes quiet with the row,
    /// rule and all, exactly as an answered question does.
    @Test
    func `a question nobody here can answer takes no attention ink`() {
        let unanswerable = FeedAsk(
            ask: Ask(questions: []),
            isAnswered: false,
            answer: nil,
            offer: FeedAskProjection.Asking(live: nil, isDriveable: false),
        )
        #expect(MinimapRowFixture.shape(.ask(unanswerable)) == .card(MinimapAskCard(
            questions: [], caption: nil, ink: .message, isRuled: false,
        )))
    }

    /// The row goes quiet the moment something answers it, and the lane has to go quiet with it — a
    /// lane still amber beside a settled question is the map disagreeing with the reading. It loses
    /// its rule with the colour, because the feed's settled card keeps none either.
    @Test
    func `a question somebody answered stops taking attention ink and its rule`() {
        let settled = FeedAsk(ask: Ask(questions: []), isAnswered: true, answer: "Both")
        #expect(MinimapRowFixture.shape(.ask(settled)) == .card(MinimapAskCard(
            questions: [], caption: nil, ink: .message, isRuled: false,
        )))
        #expect(MinimapRowFixture.shape(.ask(settled))
            .rects(across: 400, height: 90).isEmpty)
    }

    /// A row that arrived over the companion plugin is CONVENTION, and the lane may not draw it as
    /// one Argo owns (#1205). The card carries the row's own caption, at the quietest prose ink so
    /// it reads as meta rather than as more of the question — and it takes the LINE of height the
    /// row spends on it, which the card would otherwise leave empty inside its frame.
    @Test
    func `a question reported over the plugin says so in the lane too`() {
        let asked = Ask(questions: [Ask.Question(text: "Which branch?", options: [])])
        let reported = FeedAsk(ask: asked, isAnswered: false, answer: nil)
            .known(via: .convention)
        let owned = FeedAsk(ask: asked, isAnswered: false, answer: nil)

        #expect(MinimapRowFixture.shape(.ask(reported)) == .card(MinimapAskCard(
            questions: [MinimapAskCard.Question(text: "Which branch?", under: .nothing)],
            caption: FeedAskLine.reportedWords,
            ink: .attention,
            isRuled: true,
        )))
        // And the two are not the same shape, which is the whole of what degrade-down asks here.
        #expect(MinimapRowFixture.shape(.ask(reported)) != MinimapRowFixture.shape(.ask(owned)))
        #expect(MinimapRowFixture.shape(.ask(reported)).rects(across: 400, height: 90).contains {
            $0.ink == .thought
        })
    }
}
